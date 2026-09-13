// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract ChaupalSeal is ERC721 {
    uint256 public constant MAX_GROUPS = 12;

    error NotSteward(uint256 groupId);
    error GroupNotRegistered(uint256 groupId);
    error RootNotSet(uint256 groupId);
    error AlreadyClaimed(uint256 groupId, address member);
    error NotInMerkleTree(uint256 groupId, address member);
    error Soulbound();

    struct Group {
        address steward;
        bytes32 root;
    }

    mapping(uint256 groupId => Group) public groups;
    mapping(uint256 groupId => mapping(address member => bool claimed)) private _claimed;
    mapping(uint256 tokenId => uint256 groupId) private _groupOf;

    uint256 private _nextTokenId = 1;

    event GroupRegistered(uint256 indexed groupId, address indexed steward);
    event RootUpdated(uint256 indexed groupId, bytes32 root);
    event SealClaimed(uint256 indexed tokenId, uint256 indexed groupId, address indexed member);

    constructor(address[12] memory stewards) ERC721("Chaupal Seal", "SEAL") {
        for (uint256 i = 0; i < stewards.length; i++) {
            if (stewards[i] == address(0)) revert GroupNotRegistered(i);
            groups[i].steward = stewards[i];
            emit GroupRegistered(i, stewards[i]);
        }
    }

    modifier onlySteward(uint256 groupId) {
        if (msg.sender != groups[groupId].steward) revert NotSteward(groupId);
        _;
    }

    function setRoot(uint256 groupId, bytes32 root) external onlySteward(groupId) {
        groups[groupId].root = root;
        emit RootUpdated(groupId, root);
    }

    function claim(uint256 groupId, bytes32[] calldata proof) external returns (uint256 tokenId) {
        if (groups[groupId].steward == address(0)) revert GroupNotRegistered(groupId);

        if (_claimed[groupId][msg.sender]) revert AlreadyClaimed(groupId, msg.sender);

        bytes32 root = groups[groupId].root;
        if (root == bytes32(0)) revert RootNotSet(groupId);

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, groupId))));

        if (!MerkleProof.verify(proof, root, leaf)) revert NotInMerkleTree(groupId, msg.sender);

        _claimed[groupId][msg.sender] = true;

        tokenId = _nextTokenId++;
        _groupOf[tokenId] = groupId;
        _safeMint(msg.sender, tokenId);

        emit SealClaimed(tokenId, groupId, msg.sender);
        return tokenId;
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function stewardOf(uint256 groupId) external view returns (address) {
        return groups[groupId].steward;
    }

    function rootOf(uint256 groupId) external view returns (bytes32) {
        return groups[groupId].root;
    }

    function isClaimed(uint256 groupId, address member) external view returns (bool) {
        return _claimed[groupId][member];
    }

    function groupOf(uint256 tokenId) external view returns (uint256) {
        return _groupOf[tokenId];
    }
}
