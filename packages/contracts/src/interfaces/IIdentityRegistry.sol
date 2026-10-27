// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

interface IIdentityRegistry {
    function isVerified(address wallet) external view returns (bool);
    function investorOf(address wallet) external view returns (bytes32);
    function countryOf(address wallet) external view returns (uint16);
}
