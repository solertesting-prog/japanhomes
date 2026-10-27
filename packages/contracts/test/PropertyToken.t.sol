// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Compliance} from "../src/Compliance.sol";
import {PropertyToken} from "../src/PropertyToken.sol";
import {BaseTest} from "./Base.t.sol";

contract PropertyTokenTest is BaseTest {
    // --- issuance -----------------------------------------------------------

    function test_metadata() public view {
        assertEq(token.decimals(), 0);
        assertEq(token.maxSupply(), SUPPLY);
        assertEq(token.symbol(), "SHB01");
        assertEq(token.offeringRef(), "offering-uuid");
    }

    function test_agentMintsToVerifiedInvestor() public {
        _mint(alice, 100);
        assertEq(token.balanceOf(alice), 100);
        assertEq(compliance.holderCount(), 1);
        assertEq(compliance.investorBalance(ALICE), 100);
    }

    function test_mintRequiresAgent() public {
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, token.AGENT_ROLE())
        );
        vm.prank(alice);
        token.mint(alice, 1);
    }

    function test_mintToUnverifiedReverts() public {
        vm.expectRevert(abi.encodeWithSelector(PropertyToken.NotVerified.selector, mallory));
        vm.prank(agent);
        token.mint(mallory, 1);
    }

    function test_mintCannotExceedMaxSupply() public {
        _mint(alice, SUPPLY - 10);
        vm.expectRevert(abi.encodeWithSelector(PropertyToken.MaxSupplyExceeded.selector, 11, 10));
        vm.prank(agent);
        token.mint(bob, 11);
        _mint(bob, 10);
        assertEq(token.totalSupply(), SUPPLY);
    }

    function test_batchMint() public {
        address[] memory to = new address[](2);
        uint256[] memory amounts = new uint256[](2);
        (to[0], to[1], amounts[0], amounts[1]) = (alice, bob, 40, 60);
        vm.prank(agent);
        token.batchMint(to, amounts);
        assertEq(token.balanceOf(alice), 40);
        assertEq(token.balanceOf(bob), 60);
        assertEq(compliance.holderCount(), 2);

        vm.expectRevert(PropertyToken.LengthMismatch.selector);
        vm.prank(agent);
        token.batchMint(to, new uint256[](1));
    }

    function test_mintRespectsCountryRestriction() public {
        vm.startPrank(admin);
        compliance.setCountryRestricted(true);
        compliance.setCountryAllowed(JP, true);
        vm.stopPrank();
        _mint(alice, 1);
        vm.expectRevert(abi.encodeWithSelector(PropertyToken.NotCompliant.selector, compliance.REASON_COUNTRY()));
        vm.prank(agent);
        token.mint(carol, 1);
    }

    function test_mintRespectsMaxHoldersAndBalance() public {
        vm.startPrank(admin);
        compliance.setMaxHolders(2);
        compliance.setMaxBalancePerInvestor(500);
        vm.stopPrank();
        _mint(alice, 300);
        _mint(alice2, 200); // same investor: still one holder, 500 in total
        _mint(bob, 1);
        assertEq(compliance.holderCount(), 2);

        bytes32 maxHolders = compliance.REASON_MAX_HOLDERS();
        vm.expectRevert(abi.encodeWithSelector(PropertyToken.NotCompliant.selector, maxHolders));
        vm.prank(agent);
        token.mint(carol, 1);

        bytes32 maxBalance = compliance.REASON_MAX_BALANCE();
        vm.expectRevert(abi.encodeWithSelector(PropertyToken.NotCompliant.selector, maxBalance));
        vm.prank(agent);
        token.mint(alice, 1);
    }

    // --- secondary transfers ------------------------------------------------

    function test_transfersDisabledByDefault() public {
        _mint(alice, 10);
        bytes32 disabled = compliance.REASON_TRANSFERS_DISABLED();
        assertEq(token.transferCheck(alice, bob, 1), disabled);
        vm.expectRevert(abi.encodeWithSelector(PropertyToken.NotCompliant.selector, disabled));
        vm.prank(alice);
        token.transfer(bob, 1);
    }

    function test_transferBetweenVerifiedInvestorsWhenEnabled() public {
        _mint(alice, 10);
        _enableTransfers();
        assertEq(token.transferCheck(alice, bob, 4), bytes32(0));
        vm.prank(alice);
        token.transfer(bob, 4);
        assertEq(token.balanceOf(bob), 4);
        assertEq(compliance.holderCount(), 2);

        vm.prank(alice);
        token.transfer(bob, 6); // alice leaves
        assertEq(compliance.holderCount(), 1);
        assertEq(compliance.investorBalance(ALICE), 0);
    }

    function test_transferToUnverifiedReverts() public {
        _mint(alice, 10);
        _enableTransfers();
        vm.expectRevert(abi.encodeWithSelector(PropertyToken.NotVerified.selector, mallory));
        vm.prank(alice);
        token.transfer(mallory, 1);
    }

    function test_transferFromRespectsRules() public {
        _mint(alice, 10);
        vm.prank(alice);
        token.approve(carol, 5);
        bytes32 disabled = compliance.REASON_TRANSFERS_DISABLED();
        vm.expectRevert(abi.encodeWithSelector(PropertyToken.NotCompliant.selector, disabled));
        vm.prank(carol);
        token.transferFrom(alice, bob, 5);

        _enableTransfers();
        vm.prank(carol);
        token.transferFrom(alice, bob, 5);
        assertEq(token.balanceOf(bob), 5);
    }

    function test_lockupBlocksTransfersUntilItEnds() public {
        _mint(alice, 10);
        _enableTransfers();
        vm.prank(admin);
        compliance.setLockup(uint64(block.timestamp + 30 days));
        bytes32 lockup = compliance.REASON_LOCKUP();
        vm.expectRevert(abi.encodeWithSelector(PropertyToken.NotCompliant.selector, lockup));
        vm.prank(alice);
        token.transfer(bob, 1);

        vm.warp(block.timestamp + 30 days);
        vm.prank(alice);
        token.transfer(bob, 1);
        assertEq(token.balanceOf(bob), 1);
    }

    function test_maxHoldersAllowsSlotSwap() public {
        vm.prank(admin);
        compliance.setMaxHolders(1);
        _mint(alice, 10);
        _enableTransfers();
        // A partial transfer would create a second holder.
        bytes32 maxHolders = compliance.REASON_MAX_HOLDERS();
        assertEq(token.transferCheck(alice, bob, 3), maxHolders);
        // Selling the whole position frees the slot.
        vm.prank(alice);
        token.transfer(bob, 10);
        assertEq(compliance.holderCount(), 1);
    }

    function test_movingBetweenOwnWalletsIgnoresHolderAndBalanceLimits() public {
        vm.startPrank(admin);
        compliance.setMaxHolders(1);
        compliance.setMaxBalancePerInvestor(10);
        vm.stopPrank();
        _mint(alice, 10);
        _enableTransfers();
        vm.prank(alice);
        token.transfer(alice2, 4);
        assertEq(compliance.investorBalance(ALICE), 10);
        assertEq(compliance.holderCount(), 1);
    }

    // --- freezing and pause -------------------------------------------------

    function test_frozenWalletCannotSendOrReceive() public {
        _mint(alice, 10);
        _mint(bob, 10);
        _enableTransfers();
        vm.prank(agent);
        token.setAddressFrozen(alice, true);

        vm.expectRevert(abi.encodeWithSelector(PropertyToken.WalletFrozen.selector, alice));
        vm.prank(alice);
        token.transfer(bob, 1);
        vm.expectRevert(abi.encodeWithSelector(PropertyToken.WalletFrozen.selector, alice));
        vm.prank(bob);
        token.transfer(alice, 1);
    }

    function test_partialFreeze() public {
        _mint(alice, 10);
        _enableTransfers();
        vm.prank(agent);
        token.freezePartialTokens(alice, 7);
        vm.expectRevert(abi.encodeWithSelector(PropertyToken.InsufficientUnfrozenBalance.selector, alice, 4, 3));
        vm.prank(alice);
        token.transfer(bob, 4);
        vm.prank(alice);
        token.transfer(bob, 3);

        vm.expectRevert(abi.encodeWithSelector(PropertyToken.FreezeExceedsBalance.selector, alice, 1, 0));
        vm.prank(agent);
        token.freezePartialTokens(alice, 1);

        vm.expectRevert(abi.encodeWithSelector(PropertyToken.UnfreezeExceedsFrozen.selector, alice, 8, 7));
        vm.prank(agent);
        token.unfreezePartialTokens(alice, 8);
        vm.prank(agent);
        token.unfreezePartialTokens(alice, 7);
        assertEq(token.frozenTokens(alice), 0);
    }

    function test_pauseStopsTransfersButNotAgentActions() public {
        _mint(alice, 10);
        _enableTransfers();
        vm.prank(agent);
        token.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(alice);
        token.transfer(bob, 1);
        assertEq(token.transferCheck(alice, bob, 1), bytes32("PAUSED"));

        _mint(bob, 5);
        vm.prank(agent);
        token.forcedTransfer(alice, bob, 1);
        assertEq(token.balanceOf(bob), 6);

        vm.prank(agent);
        token.unpause();
        vm.prank(alice);
        token.transfer(bob, 1);
    }

    // --- agent moves --------------------------------------------------------

    function test_forcedTransferBypassesRulesButNeedsVerifiedReceiver() public {
        _mint(alice, 10);
        vm.prank(agent);
        token.freezePartialTokens(alice, 8);

        vm.expectRevert(abi.encodeWithSelector(PropertyToken.NotVerified.selector, mallory));
        vm.prank(agent);
        token.forcedTransfer(alice, mallory, 1);

        // Transfers are disabled and 8 tokens are frozen: the agent can still move 9.
        vm.prank(agent);
        token.forcedTransfer(alice, bob, 9);
        assertEq(token.balanceOf(bob), 9);
        assertEq(token.frozenTokens(alice), 1);
        assertEq(compliance.holderCount(), 2);
    }

    function test_burnReleasesFrozenTokens() public {
        _mint(alice, 10);
        vm.prank(agent);
        token.freezePartialTokens(alice, 10);
        vm.prank(agent);
        token.burn(alice, 4);
        assertEq(token.balanceOf(alice), 6);
        assertEq(token.frozenTokens(alice), 6);
        assertEq(compliance.investorBalance(ALICE), 6);

        vm.prank(agent);
        token.burn(alice, 6);
        assertEq(compliance.holderCount(), 0);
    }

    function test_recoveryMovesBalanceAndFrozenStateToSameInvestor() public {
        _mint(alice, 10);
        vm.startPrank(agent);
        token.freezePartialTokens(alice, 3);
        token.setAddressFrozen(alice, true);

        vm.expectRevert(abi.encodeWithSelector(PropertyToken.InvestorMismatch.selector, alice, bob));
        token.recoveryAddress(alice, bob);

        token.recoveryAddress(alice, alice2);
        vm.stopPrank();

        assertEq(token.balanceOf(alice), 0);
        assertEq(token.balanceOf(alice2), 10);
        assertEq(token.frozenTokens(alice2), 3);
        assertEq(token.frozenTokens(alice), 0);
        assertTrue(token.frozen(alice2));
        assertEq(compliance.investorBalance(ALICE), 10);
        assertEq(compliance.holderCount(), 1);
    }

    function test_recoveryWorksAfterLostWalletIdentityIsDeleted() public {
        _mint(alice, 10);
        vm.startPrank(agent);
        registry.deleteIdentity(alice);
        token.recoveryAddress(alice, alice2);
        vm.stopPrank();
        assertEq(token.balanceOf(alice2), 10);
    }

    function test_expiredKycBlocksReceiving() public {
        _mint(alice, 10);
        _enableTransfers();
        vm.prank(agent);
        registry.setExpiry(bob, uint64(block.timestamp - 1));
        vm.expectRevert(abi.encodeWithSelector(PropertyToken.NotVerified.selector, bob));
        vm.prank(alice);
        token.transfer(bob, 1);
    }

    function test_complianceHooksOnlyCallableByToken() public {
        vm.expectRevert(Compliance.OnlyToken.selector);
        compliance.created(alice, 1);
        vm.expectRevert(Compliance.TokenAlreadyBound.selector);
        vm.prank(admin);
        compliance.bindToken(address(1));
    }

    // --- fuzz ---------------------------------------------------------------

    function testFuzz_investorAccountingMatchesBalances(uint96 a, uint96 b, uint96 moved) public {
        uint256 amountA = _bound(a, 1, SUPPLY / 2);
        uint256 amountB = _bound(b, 1, SUPPLY / 2);
        _mint(alice, amountA);
        _mint(bob, amountB);
        _enableTransfers();
        uint256 m = _bound(moved, 0, amountA);
        vm.prank(alice);
        token.transfer(bob, m);

        assertEq(compliance.investorBalance(ALICE), token.balanceOf(alice) + token.balanceOf(alice2));
        assertEq(compliance.investorBalance(BOB), token.balanceOf(bob));
        assertEq(compliance.holderCount(), m == amountA ? 1 : 2);
        assertEq(token.totalSupply(), amountA + amountB);
    }
}
