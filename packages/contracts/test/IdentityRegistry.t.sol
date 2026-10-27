// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {BaseTest} from "./Base.t.sol";

contract IdentityRegistryTest is BaseTest {
    function test_registeredWalletsAreVerified() public view {
        assertTrue(registry.isVerified(alice));
        assertTrue(registry.isVerified(alice2));
        assertEq(registry.investorOf(alice2), ALICE);
        assertEq(registry.countryOf(carol), ES);
        assertFalse(registry.isVerified(mallory));
    }

    function test_onlyAgentRegisters() public {
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, registry.AGENT_ROLE())
        );
        vm.prank(alice);
        registry.registerIdentity(mallory, keccak256("x"), JP, uint64(block.timestamp + 1 days));
    }

    function test_rejectsInvalidInput() public {
        vm.startPrank(agent);
        vm.expectRevert(IdentityRegistry.ZeroAddress.selector);
        registry.registerIdentity(address(0), keccak256("x"), JP, uint64(block.timestamp + 1));
        vm.expectRevert(IdentityRegistry.InvalidInvestorId.selector);
        registry.registerIdentity(mallory, bytes32(0), JP, uint64(block.timestamp + 1));
        vm.expectRevert(IdentityRegistry.InvalidCountry.selector);
        registry.registerIdentity(mallory, keccak256("x"), 0, uint64(block.timestamp + 1));
        vm.expectRevert(abi.encodeWithSelector(IdentityRegistry.ExpiryInPast.selector, uint64(block.timestamp)));
        registry.registerIdentity(mallory, keccak256("x"), JP, uint64(block.timestamp));
        vm.expectRevert(abi.encodeWithSelector(IdentityRegistry.AlreadyRegistered.selector, alice));
        registry.registerIdentity(alice, keccak256("x"), JP, uint64(block.timestamp + 1));
        vm.stopPrank();
    }

    function test_expiryEndsVerification() public {
        vm.warp(block.timestamp + 366 days);
        assertFalse(registry.isVerified(alice));
        vm.prank(agent);
        registry.setExpiry(alice, uint64(block.timestamp + 30 days));
        assertTrue(registry.isVerified(alice));
    }

    function test_deleteAndUpdate() public {
        vm.startPrank(agent);
        registry.updateCountry(bob, ES);
        assertEq(registry.countryOf(bob), ES);
        registry.deleteIdentity(bob);
        vm.stopPrank();
        assertFalse(registry.isVerified(bob));
        assertEq(registry.investorOf(bob), bytes32(0));

        vm.expectRevert(abi.encodeWithSelector(IdentityRegistry.NotRegistered.selector, bob));
        vm.prank(agent);
        registry.deleteIdentity(bob);
    }
}
