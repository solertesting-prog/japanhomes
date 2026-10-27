// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

/// @notice Transfer rules for one token (the "Modular Compliance" role of ERC-3643).
interface ICompliance {
    /// @notice Whether a holder-to-holder transfer is allowed. Minting passes `from == address(0)`.
    function canTransfer(address from, address to, uint256 amount) external view returns (bool);
    /// @notice Same check, returning a machine-readable reason (bytes32(0) when allowed).
    function checkTransfer(address from, address to, uint256 amount) external view returns (bytes32 reason);

    /// @notice Investor a wallet's tokens are booked to (bytes32(0) if it never held any).
    function walletInvestor(address wallet) external view returns (bytes32);

    function transferred(address from, address to, uint256 amount) external;
    function created(address to, uint256 amount) external;
    function destroyed(address from, uint256 amount) external;
}
