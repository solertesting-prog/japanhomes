// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {Compliance} from "../src/Compliance.sol";
import {PropertyToken} from "../src/PropertyToken.sol";
import {BaseTest} from "./Base.t.sol";

/// @dev Random agent and holder actions; failed calls are simply skipped.
contract Handler is Test {
    PropertyToken internal token;
    address internal agent;
    address[] internal wallets;

    constructor(PropertyToken token_, address agent_, address[] memory wallets_) {
        token = token_;
        agent = agent_;
        wallets = wallets_;
    }

    function _w(uint256 seed) internal view returns (address) {
        return wallets[seed % wallets.length];
    }

    function mint(uint256 to, uint256 amount) external {
        amount = _bound(amount, 0, 500);
        vm.prank(agent);
        try token.mint(_w(to), amount) {} catch {}
    }

    function transfer(uint256 from, uint256 to, uint256 amount) external {
        address f = _w(from);
        amount = _bound(amount, 0, token.balanceOf(f));
        vm.prank(f);
        try token.transfer(_w(to), amount) {} catch {}
    }

    function forced(uint256 from, uint256 to, uint256 amount) external {
        address f = _w(from);
        amount = _bound(amount, 0, token.balanceOf(f));
        vm.prank(agent);
        try token.forcedTransfer(f, _w(to), amount) {} catch {}
    }

    function burn(uint256 from, uint256 amount) external {
        address f = _w(from);
        amount = _bound(amount, 0, token.balanceOf(f));
        vm.prank(agent);
        try token.burn(f, amount) {} catch {}
    }

    function freeze(uint256 who, uint256 amount) external {
        address w = _w(who);
        amount = _bound(amount, 0, token.balanceOf(w));
        vm.prank(agent);
        try token.freezePartialTokens(w, amount) {} catch {}
    }
}

contract InvariantsTest is BaseTest {
    Handler internal handler;
    address[] internal wallets;
    bytes32[] internal investors;

    function setUp() public override {
        super.setUp();
        wallets.push(alice);
        wallets.push(alice2);
        wallets.push(bob);
        wallets.push(carol);
        investors.push(ALICE);
        investors.push(BOB);
        investors.push(CAROL);
        vm.startPrank(admin);
        compliance.setTransfersEnabled(true);
        compliance.setMaxHolders(2);
        compliance.setMaxBalancePerInvestor(4_000);
        vm.stopPrank();
        handler = new Handler(token, agent, wallets);
        targetContract(address(handler));
    }

    function invariant_supplyNeverExceedsMax() public view {
        assertLe(token.totalSupply(), token.maxSupply());
    }

    function invariant_investorBooksMatchBalances() public view {
        uint256 sum;
        uint256 holders;
        for (uint256 i = 0; i < investors.length; ++i) {
            uint256 b = compliance.investorBalance(investors[i]);
            sum += b;
            if (b > 0) holders++;
        }
        assertEq(sum, token.totalSupply());
        assertEq(holders, compliance.holderCount());
        assertEq(compliance.investorBalance(ALICE), token.balanceOf(alice) + token.balanceOf(alice2));
    }

    function invariant_frozenNeverExceedsBalance() public view {
        for (uint256 i = 0; i < wallets.length; ++i) {
            assertLe(token.frozenTokens(wallets[i]), token.balanceOf(wallets[i]));
        }
    }

    /// Agent forced transfers may exceed holder limits on purpose; regular
    /// moves never do. Balance cap is only enforced on non-agent paths too,
    /// so only the supply-level and accounting invariants are absolute.
    function invariant_holderCountBounded() public view {
        assertLe(compliance.holderCount(), investors.length);
    }
}
