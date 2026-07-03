// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ZiconToken {
    string public name = "Zicon Token";
    string public symbol = "ZIC";
    uint256 public totalSupply = 1000000 * 10**18;
    mapping(address => uint256) public balances;
    constructor() { balances[msg.sender] = totalSupply; }
    function getBalance(address account) public view returns (uint256) {
        return balances[account];
    }
}