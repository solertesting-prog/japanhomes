// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ICompliance} from "./interfaces/ICompliance.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";

/**
 * @title PropertyToken
 * @notice Permissioned token representing participations in one property
 *         offering, following the ERC-3643 model: every holder must be a
 *         verified investor in the IdentityRegistry and every holder-to-holder
 *         move must pass the offering's Compliance rules.
 *
 * Legal position: the token is a register of entitlements kept in sync with
 * the off-chain register held by the platform (the database is the legal
 * source of truth). It carries no money: rent distributions are paid off-chain
 * by an authorised payment provider from a holder snapshot.
 *
 * Roles
 *   DEFAULT_ADMIN_ROLE  issuer / platform multisig: grants and revokes roles.
 *   AGENT_ROLE          platform operations (via a regulated custodian):
 *                       issue, redeem, freeze, pause, forced transfer, recovery.
 *
 * Agent actions (`forcedTransfer`, `recoveryAddress`, `burn`) bypass the
 * transfer rules on purpose — they execute decisions taken off-chain (court
 * order, lost wallet, refund) — but the receiver must still be verified.
 *
 * Whole tokens only: `decimals()` is 0, matching `totalTokens` in the database.
 */
contract PropertyToken is ERC20, AccessControl, Pausable {
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    IIdentityRegistry public immutable identityRegistry;
    ICompliance public immutable compliance;
    /// @notice Total tokens of the offering; issuance can never exceed it.
    uint256 public immutable maxSupply;
    /// @notice Off-chain offering identifier (database UUID), for reconciliation.
    string public offeringRef;

    mapping(address wallet => bool) public frozen;
    mapping(address wallet => uint256) public frozenTokens;

    /// @dev Set only for the duration of an agent move (EIP-1153 transient storage).
    bool private transient _agentMove;

    error ZeroAddress();
    error MaxSupplyExceeded(uint256 requested, uint256 available);
    error NotVerified(address wallet);
    error NotCompliant(bytes32 reason);
    error WalletFrozen(address wallet);
    error InsufficientUnfrozenBalance(address wallet, uint256 requested, uint256 available);
    error FreezeExceedsBalance(address wallet, uint256 requested, uint256 available);
    error UnfreezeExceedsFrozen(address wallet, uint256 requested, uint256 frozenAmount);
    error LengthMismatch();
    error InvestorMismatch(address lostWallet, address newWallet);
    error NothingToRecover(address lostWallet);

    event AddressFrozen(address indexed wallet, bool frozen, address indexed agent);
    event TokensFrozen(address indexed wallet, uint256 amount);
    event TokensUnfrozen(address indexed wallet, uint256 amount);
    event ForcedTransfer(address indexed from, address indexed to, uint256 amount, address indexed agent);
    event RecoverySuccess(address indexed lostWallet, address indexed newWallet, uint256 amount);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        string memory offeringRef_,
        address admin,
        IIdentityRegistry registry,
        ICompliance compliance_
    ) ERC20(name_, symbol_) {
        if (admin == address(0) || address(registry) == address(0) || address(compliance_) == address(0)) {
            revert ZeroAddress();
        }
        identityRegistry = registry;
        compliance = compliance_;
        maxSupply = maxSupply_;
        offeringRef = offeringRef_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function decimals() public pure override returns (uint8) {
        return 0;
    }

    // --- issuance and redemption -------------------------------------------

    function mint(address to, uint256 amount) public onlyRole(AGENT_ROLE) {
        uint256 available = maxSupply - totalSupply();
        if (amount > available) revert MaxSupplyExceeded(amount, available);
        if (!identityRegistry.isVerified(to)) revert NotVerified(to);
        bytes32 reason = compliance.checkTransfer(address(0), to, amount);
        if (reason != bytes32(0)) revert NotCompliant(reason);
        _mint(to, amount);
    }

    /// @notice Allocation of a closed subscription round in one transaction.
    function batchMint(address[] calldata to, uint256[] calldata amounts) external onlyRole(AGENT_ROLE) {
        if (to.length != amounts.length) revert LengthMismatch();
        for (uint256 i = 0; i < to.length; ++i) {
            mint(to[i], amounts[i]);
        }
    }

    /// @notice Redemption or refund. Frozen tokens are released first if needed.
    function burn(address from, uint256 amount) external onlyRole(AGENT_ROLE) {
        _releaseFrozenFor(from, amount);
        _burn(from, amount);
    }

    // --- agent moves ---------------------------------------------------------

    function forcedTransfer(address from, address to, uint256 amount) external onlyRole(AGENT_ROLE) {
        if (!identityRegistry.isVerified(to)) revert NotVerified(to);
        _releaseFrozenFor(from, amount);
        _agentMove = true;
        _transfer(from, to, amount);
        _agentMove = false;
        emit ForcedTransfer(from, to, amount, msg.sender);
    }

    /**
     * @notice Moves everything from a lost wallet to a new wallet of the SAME
     *         investor, carrying over its frozen state.
     */
    function recoveryAddress(address lostWallet, address newWallet) external onlyRole(AGENT_ROLE) {
        uint256 amount = balanceOf(lostWallet);
        if (amount == 0) revert NothingToRecover(lostWallet);
        if (!identityRegistry.isVerified(newWallet)) revert NotVerified(newWallet);
        bytes32 owner = compliance.walletInvestor(lostWallet);
        if (owner == bytes32(0) || owner != identityRegistry.investorOf(newWallet)) {
            revert InvestorMismatch(lostWallet, newWallet);
        }
        uint256 frozenAmount = frozenTokens[lostWallet];
        frozenTokens[lostWallet] = 0;
        _agentMove = true;
        _transfer(lostWallet, newWallet, amount);
        _agentMove = false;
        frozenTokens[newWallet] += frozenAmount;
        if (frozen[lostWallet]) {
            frozen[newWallet] = true;
            emit AddressFrozen(newWallet, true, msg.sender);
        }
        emit RecoverySuccess(lostWallet, newWallet, amount);
    }

    // --- freezing and pause --------------------------------------------------

    function setAddressFrozen(address wallet, bool isFrozen) external onlyRole(AGENT_ROLE) {
        frozen[wallet] = isFrozen;
        emit AddressFrozen(wallet, isFrozen, msg.sender);
    }

    function freezePartialTokens(address wallet, uint256 amount) external onlyRole(AGENT_ROLE) {
        uint256 available = balanceOf(wallet) - frozenTokens[wallet];
        if (amount > available) revert FreezeExceedsBalance(wallet, amount, available);
        frozenTokens[wallet] += amount;
        emit TokensFrozen(wallet, amount);
    }

    function unfreezePartialTokens(address wallet, uint256 amount) external onlyRole(AGENT_ROLE) {
        uint256 current = frozenTokens[wallet];
        if (amount > current) revert UnfreezeExceedsFrozen(wallet, amount, current);
        frozenTokens[wallet] = current - amount;
        emit TokensUnfrozen(wallet, amount);
    }

    function pause() external onlyRole(AGENT_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(AGENT_ROLE) {
        _unpause();
    }

    // --- views ---------------------------------------------------------------

    /// @notice Why a holder-to-holder transfer would fail (bytes32(0) if it would succeed).
    function transferCheck(address from, address to, uint256 amount) external view returns (bytes32) {
        if (paused()) return "PAUSED";
        if (frozen[from] || frozen[to]) return "WALLET_FROZEN";
        if (amount > balanceOf(from) - frozenTokens[from]) return "INSUFFICIENT_UNFROZEN";
        if (!identityRegistry.isVerified(to)) return "RECEIVER_NOT_VERIFIED";
        return compliance.checkTransfer(from, to, amount);
    }

    // --- internals -----------------------------------------------------------

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && !_agentMove) {
            _requireNotPaused();
            if (frozen[from]) revert WalletFrozen(from);
            if (frozen[to]) revert WalletFrozen(to);
            uint256 free = balanceOf(from) - frozenTokens[from];
            if (value > free) revert InsufficientUnfrozenBalance(from, value, free);
            if (!identityRegistry.isVerified(to)) revert NotVerified(to);
            bytes32 reason = compliance.checkTransfer(from, to, value);
            if (reason != bytes32(0)) revert NotCompliant(reason);
        }
        super._update(from, to, value);
        if (from == address(0)) compliance.created(to, value);
        else if (to == address(0)) compliance.destroyed(from, value);
        else compliance.transferred(from, to, value);
    }

    /// @dev Agent moves may consume frozen tokens; release exactly what is needed.
    function _releaseFrozenFor(address wallet, uint256 amount) private {
        uint256 free = balanceOf(wallet) - frozenTokens[wallet];
        if (amount > free) {
            uint256 release = amount - free;
            // If amount exceeds the whole balance, ERC20 reverts below anyway.
            if (release > frozenTokens[wallet]) release = frozenTokens[wallet];
            frozenTokens[wallet] -= release;
            emit TokensUnfrozen(wallet, release);
        }
    }
}
