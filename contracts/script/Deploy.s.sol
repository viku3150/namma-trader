// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MockCustody} from "../src/MockCustody.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        MockCustody custody = new MockCustody();
        
        console.log("MockCustody deployed at:", address(custody));
        
        vm.stopBroadcast();
    }
}
