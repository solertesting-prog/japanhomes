// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {Compliance} from "../src/Compliance.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {PropertyToken} from "../src/PropertyToken.sol";

abstract contract BaseTest is Test {
    uint16 internal constant JP = 0x4A50; // "JP"
    uint16 internal constant ES = 0x4553; // "ES"
    uint256 internal constant SUPPLY = 10_000;

    address internal admin = makeAddr("admin");
    address internal agent = makeAddr("agent");
    address internal alice = makeAddr("alice");
    address internal alice2 = makeAddr("alice-second-wallet");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal mallory = makeAddr("mallory"); // never registered

    bytes32 internal constant ALICE = keccak256("investor:alice");
    bytes32 internal constant BOB = keccak256("investor:bob");
    bytes32 internal constant CAROL = keccak256("investor:carol");

    IdentityRegistry internal registry;
    Compliance internal compliance;
    PropertyToken internal token;

    function setUp() public virtual {
        vm.warp(1_800_000_000);
        registry = new IdentityRegistry(admin);
        compliance = new Compliance(admin, registry);
        token = new PropertyToken("Shibuya Residence DEMO", "SHB01", SUPPLY, "offering-uuid", admin, registry, compliance);

        vm.startPrank(admin);
        registry.grantRole(registry.AGENT_ROLE(), agent);
        token.grantRole(token.AGENT_ROLE(), agent);
        compliance.bindToken(address(token));
        vm.stopPrank();

        uint64 expiry = uint64(block.timestamp + 365 days);
        vm.startPrank(agent);
        registry.registerIdentity(alice, ALICE, JP, expiry);
        registry.registerIdentity(alice2, ALICE, JP, expiry);
        registry.registerIdentity(bob, BOB, JP, expiry);
        registry.registerIdentity(carol, CAROL, ES, expiry);
        vm.stopPrank();
    }

    function _mint(address to, uint256 amount) internal {
        vm.prank(agent);
        token.mint(to, amount);
    }

    function _enableTransfers() internal {
        vm.prank(admin);
        compliance.setTransfersEnabled(true);
    }
}
