// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ICompliance} from "./interfaces/ICompliance.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";

/**
 * @title Compliance
 * @notice Transfer rules for a single PropertyToken, evaluated per investor
 *         (all wallets sharing an `investorId` count as one holder):
 *
 *   - Secondary transfers between investors are OFF by default. The platform's
 *     secondary market is a regulated activity that is BLOCKED until approved
 *     (see the shared package regulatory gates); only issuance, redemption and agent
 *     forced transfers move tokens until then.
 *   - Optional lock-up: no holder-to-holder transfer before `lockupUntil`.
 *   - Allowed countries of residence (ISO 3166-1 alpha-2 packed in two bytes,
 *     "JP" = 0x4A50), when restricted.
 *   - Maximum number of distinct investors holding the token.
 *   - Maximum balance per investor.
 *
 * Bookkeeping: the investor a wallet's tokens belong to is captured when the
 * wallet receives tokens, so later changes to the identity registry (e.g. a
 * deleted identity) cannot desynchronise the per-investor counts.
 */
contract Compliance is AccessControl, ICompliance {
    bytes32 public constant RULES_ROLE = keccak256("RULES_ROLE");

    bytes32 public constant OK = bytes32(0);
    bytes32 public constant REASON_TRANSFERS_DISABLED = "TRANSFERS_DISABLED";
    bytes32 public constant REASON_LOCKUP = "LOCKUP";
    bytes32 public constant REASON_UNKNOWN_INVESTOR = "UNKNOWN_INVESTOR";
    bytes32 public constant REASON_COUNTRY = "COUNTRY_NOT_ALLOWED";
    bytes32 public constant REASON_MAX_HOLDERS = "MAX_HOLDERS";
    bytes32 public constant REASON_MAX_BALANCE = "MAX_BALANCE";

    IIdentityRegistry public immutable identityRegistry;
    address public token;

    bool public transfersEnabled;
    uint64 public lockupUntil;
    bool public countryRestricted;
    mapping(uint16 country => bool) public countryAllowed;
    uint256 public maxHolders;
    uint256 public maxBalancePerInvestor;

    uint256 public holderCount;
    mapping(bytes32 investorId => uint256) public investorBalance;
    mapping(address wallet => bytes32) public walletInvestor;

    error ZeroAddress();
    error TokenAlreadyBound();
    error OnlyToken();
    error UnknownInvestor(address wallet);

    event TokenBound(address indexed token);
    event TransfersEnabled(bool enabled);
    event LockupSet(uint64 until);
    event CountryRestriction(bool restricted);
    event CountryAllowed(uint16 indexed country, bool allowed);
    event MaxHoldersSet(uint256 maxHolders);
    event MaxBalanceSet(uint256 maxBalancePerInvestor);

    constructor(address admin, IIdentityRegistry registry) {
        if (admin == address(0) || address(registry) == address(0)) revert ZeroAddress();
        identityRegistry = registry;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RULES_ROLE, admin);
    }

    modifier onlyToken() {
        if (msg.sender != token) revert OnlyToken();
        _;
    }

    // --- configuration -------------------------------------------------------

    function bindToken(address token_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token_ == address(0)) revert ZeroAddress();
        if (token != address(0)) revert TokenAlreadyBound();
        token = token_;
        emit TokenBound(token_);
    }

    function setTransfersEnabled(bool enabled) external onlyRole(RULES_ROLE) {
        transfersEnabled = enabled;
        emit TransfersEnabled(enabled);
    }

    function setLockup(uint64 until) external onlyRole(RULES_ROLE) {
        lockupUntil = until;
        emit LockupSet(until);
    }

    function setCountryRestricted(bool restricted) external onlyRole(RULES_ROLE) {
        countryRestricted = restricted;
        emit CountryRestriction(restricted);
    }

    function setCountryAllowed(uint16 country, bool allowed) external onlyRole(RULES_ROLE) {
        countryAllowed[country] = allowed;
        emit CountryAllowed(country, allowed);
    }

    function setMaxHolders(uint256 max) external onlyRole(RULES_ROLE) {
        maxHolders = max;
        emit MaxHoldersSet(max);
    }

    function setMaxBalancePerInvestor(uint256 max) external onlyRole(RULES_ROLE) {
        maxBalancePerInvestor = max;
        emit MaxBalanceSet(max);
    }

    // --- checks --------------------------------------------------------------

    function canTransfer(address from, address to, uint256 amount) external view returns (bool) {
        return checkTransfer(from, to, amount) == OK;
    }

    function checkTransfer(address from, address to, uint256 amount) public view returns (bytes32) {
        if (from != address(0)) {
            if (!transfersEnabled) return REASON_TRANSFERS_DISABLED;
            if (block.timestamp < lockupUntil) return REASON_LOCKUP;
        }
        return checkReceiver(from, to, amount);
    }

    /// @notice Receiver-side rules only (country, holders, balance). Also used
    ///         for issuance, where transfer-level rules do not apply.
    function checkReceiver(address from, address to, uint256 amount) public view returns (bytes32) {
        bytes32 toId = walletInvestor[to];
        if (toId == bytes32(0)) toId = identityRegistry.investorOf(to);
        if (toId == bytes32(0)) return REASON_UNKNOWN_INVESTOR;
        if (countryRestricted && !countryAllowed[identityRegistry.countryOf(to)]) return REASON_COUNTRY;

        bytes32 fromId = from == address(0) ? bytes32(0) : walletInvestor[from];
        if (fromId == toId) return OK; // moving between wallets of the same investor

        uint256 newBalance = investorBalance[toId] + amount;
        if (maxBalancePerInvestor != 0 && newBalance > maxBalancePerInvestor) return REASON_MAX_BALANCE;
        if (maxHolders != 0 && investorBalance[toId] == 0 && amount > 0) {
            // A sender that empties its position frees its slot in the same move.
            bool senderLeaves = fromId != bytes32(0) && investorBalance[fromId] == amount;
            if (holderCount >= maxHolders && !senderLeaves) return REASON_MAX_HOLDERS;
        }
        return OK;
    }

    // --- bookkeeping (token only) -------------------------------------------

    function transferred(address from, address to, uint256 amount) external onlyToken {
        _debit(from, amount);
        _credit(to, amount);
    }

    function created(address to, uint256 amount) external onlyToken {
        _credit(to, amount);
    }

    function destroyed(address from, uint256 amount) external onlyToken {
        _debit(from, amount);
    }

    function _credit(address wallet, uint256 amount) private {
        bytes32 id = walletInvestor[wallet];
        if (id == bytes32(0)) {
            id = identityRegistry.investorOf(wallet);
            if (id == bytes32(0)) revert UnknownInvestor(wallet);
            walletInvestor[wallet] = id;
        }
        if (amount == 0) return;
        if (investorBalance[id] == 0) holderCount += 1;
        investorBalance[id] += amount;
    }

    function _debit(address wallet, uint256 amount) private {
        if (amount == 0) return;
        bytes32 id = walletInvestor[wallet];
        if (id == bytes32(0)) revert UnknownInvestor(wallet);
        investorBalance[id] -= amount;
        if (investorBalance[id] == 0) holderCount -= 1;
    }
}
