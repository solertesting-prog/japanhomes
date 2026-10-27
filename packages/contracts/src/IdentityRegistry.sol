// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";

/**
 * @title IdentityRegistry
 * @notice Wallet → verified investor mapping consulted by every permissioned
 *         token of the platform (the "Identity Registry" of ERC-3643).
 *
 * Simplification versus the ERC-3643 reference (T-REX): instead of ONCHAINID
 * identity contracts carrying signed claims from trusted issuers, the platform's
 * KYC agent writes an attestation directly here once the off-chain KYC/AML case
 * is approved. No personal data is stored on-chain: `investorId` is an opaque
 * salted hash computed off-chain, `country` is the ISO 3166-1 alpha-2 code of
 * residence packed in two bytes ("JP" = 0x4A50) and `expiresAt` mirrors the
 * KYC validity window.
 *
 * [VALIDAR] Production should use the licensed partner's ERC-3643 stack
 * (ONCHAINID + claim topics) or have this simplification approved by counsel.
 *
 * One investor may control several wallets (e.g. after a recovery); they share
 * the same `investorId`, so holder limits are counted per investor, not per wallet.
 */
contract IdentityRegistry is AccessControl, IIdentityRegistry {
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    struct Identity {
        bytes32 investorId;
        uint16 country;
        uint64 expiresAt;
    }

    mapping(address wallet => Identity) private _identities;

    error ZeroAddress();
    error InvalidInvestorId();
    error InvalidCountry();
    error AlreadyRegistered(address wallet);
    error NotRegistered(address wallet);
    error ExpiryInPast(uint64 expiresAt);

    event IdentityRegistered(address indexed wallet, bytes32 indexed investorId, uint16 country, uint64 expiresAt);
    event IdentityRemoved(address indexed wallet, bytes32 indexed investorId);
    event CountryUpdated(address indexed wallet, uint16 country);
    event ExpiryUpdated(address indexed wallet, uint64 expiresAt);

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function registerIdentity(address wallet, bytes32 investorId, uint16 country, uint64 expiresAt)
        external
        onlyRole(AGENT_ROLE)
    {
        if (wallet == address(0)) revert ZeroAddress();
        if (investorId == bytes32(0)) revert InvalidInvestorId();
        if (country == 0) revert InvalidCountry();
        if (expiresAt <= block.timestamp) revert ExpiryInPast(expiresAt);
        if (_identities[wallet].investorId != bytes32(0)) revert AlreadyRegistered(wallet);
        _identities[wallet] = Identity(investorId, country, expiresAt);
        emit IdentityRegistered(wallet, investorId, country, expiresAt);
    }

    /// @notice Removes a wallet. Tokens it still holds become frozen in practice:
    ///         an unverified wallet can neither send nor receive.
    function deleteIdentity(address wallet) external onlyRole(AGENT_ROLE) {
        bytes32 id = _requireRegistered(wallet).investorId;
        delete _identities[wallet];
        emit IdentityRemoved(wallet, id);
    }

    function updateCountry(address wallet, uint16 country) external onlyRole(AGENT_ROLE) {
        if (country == 0) revert InvalidCountry();
        _requireRegistered(wallet).country = country;
        emit CountryUpdated(wallet, country);
    }

    /// @notice Renewal after a KYC refresh, or an expiry in the past to suspend.
    function setExpiry(address wallet, uint64 expiresAt) external onlyRole(AGENT_ROLE) {
        _requireRegistered(wallet).expiresAt = expiresAt;
        emit ExpiryUpdated(wallet, expiresAt);
    }

    function isVerified(address wallet) external view returns (bool) {
        Identity storage i = _identities[wallet];
        return i.investorId != bytes32(0) && i.expiresAt > block.timestamp;
    }

    function investorOf(address wallet) external view returns (bytes32) {
        return _identities[wallet].investorId;
    }

    function countryOf(address wallet) external view returns (uint16) {
        return _identities[wallet].country;
    }

    function identityOf(address wallet) external view returns (bytes32 investorId, uint16 country, uint64 expiresAt) {
        Identity storage i = _identities[wallet];
        return (i.investorId, i.country, i.expiresAt);
    }

    function _requireRegistered(address wallet) private view returns (Identity storage i) {
        i = _identities[wallet];
        if (i.investorId == bytes32(0)) revert NotRegistered(wallet);
    }
}
