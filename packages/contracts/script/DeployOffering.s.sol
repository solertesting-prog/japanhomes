// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {Compliance} from "../src/Compliance.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {PropertyToken} from "../src/PropertyToken.sol";

/**
 * Deploys the contracts for one offering on a TESTNET.
 *
 *   ADMIN=0x...  AGENT=0x...  TOKEN_NAME="..."  TOKEN_SYMBOL=SHB01  MAX_SUPPLY=10000 \
 *   OFFERING_REF=<uuid>  [REGISTRY=0x... to reuse the platform registry] \
 *   forge script script/DeployOffering.s.sol --rpc-url $BASE_SEPOLIA_RPC --broadcast
 *
 * Refuses to run on Ethereum or Base mainnet: real issuance requires the
 * licensed partner, legal approval and an independent audit first.
 *
 * Note: the deployer must be ADMIN for the bindToken / role grants below; in
 * production ADMIN is a multisig and those steps are separate proposals.
 */
contract DeployOffering is Script {
    function run() external {
        require(block.chainid != 1 && block.chainid != 8453, "Mainnet deployment is not allowed from this script");

        address admin = vm.envAddress("ADMIN");
        address agent = vm.envAddress("AGENT");
        string memory name = vm.envString("TOKEN_NAME");
        string memory symbol = vm.envString("TOKEN_SYMBOL");
        uint256 maxSupply = vm.envUint("MAX_SUPPLY");
        string memory offeringRef = vm.envString("OFFERING_REF");
        address existingRegistry = vm.envOr("REGISTRY", address(0));

        vm.startBroadcast();
        IdentityRegistry registry;
        if (existingRegistry == address(0)) {
            registry = new IdentityRegistry(admin);
            registry.grantRole(registry.AGENT_ROLE(), agent);
        } else {
            registry = IdentityRegistry(existingRegistry);
        }
        Compliance compliance = new Compliance(admin, registry);
        PropertyToken token = new PropertyToken(name, symbol, maxSupply, offeringRef, admin, registry, compliance);
        compliance.bindToken(address(token));
        // Japan-resident investors only by default; secondary transfers stay off.
        compliance.setCountryRestricted(true);
        compliance.setCountryAllowed(392, true);
        token.grantRole(token.AGENT_ROLE(), agent);
        vm.stopBroadcast();

        console2.log("IdentityRegistry", address(registry));
        console2.log("Compliance", address(compliance));
        console2.log("PropertyToken", address(token));
    }
}
