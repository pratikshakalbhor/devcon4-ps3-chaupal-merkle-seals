// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ChaupalSeal} from "../src/ChaupalSeal.sol";

contract DeployChaupalSeal is Script {
    function run() external returns (ChaupalSeal seal) {
        string memory json = vm.readFile("./data/groups.json");
        address[12] memory stewards;
        for (uint256 i = 0; i < 12; i++) {
            stewards[i] = vm.parseJsonAddress(json, string.concat(".groups[", vm.toString(i), "].steward"));
        }
        vm.startBroadcast();
        seal = new ChaupalSeal(stewards);
        vm.stopBroadcast();
        console2.log("ChaupalSeal deployed at", address(seal));
        console2.log("group0 steward:", seal.stewardOf(0));
        console2.log("group0 root  :", uint256(seal.rootOf(0)));
    }
}
