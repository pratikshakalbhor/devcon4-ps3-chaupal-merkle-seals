// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ChaupalSeal} from "../src/ChaupalSeal.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract ChaupalSealTest is Test {
    ChaupalSeal internal seal;
    address[12] internal stewards;

    bytes32 internal root0;
    bytes32 internal root1;
    address[] internal members0;
    bytes32[][] internal proofs0;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal mallory = makeAddr("mallory");

    function setUp() public {
        for (uint256 i = 0; i < 12; i++) {
            stewards[i] = address(uint160(0x1000 + i));
        }
        seal = new ChaupalSeal(stewards);

        string memory f0 = vm.readFile("./data/forge/group-0.json");
        string memory f1 = vm.readFile("./data/forge/group-1.json");
        root0 = vm.parseJsonBytes32(f0, ".root");
        root1 = vm.parseJsonBytes32(f1, ".root");
        uint256 count = vm.parseJsonUint(f0, ".count");
        for (uint256 i = 0; i < count; i++) {
            members0.push(vm.parseJsonAddress(f0, string.concat(".members[", vm.toString(i), "].a")));
            proofs0.push(vm.parseJsonBytes32Array(f0, string.concat(".members[", vm.toString(i), "].p")));
        }
    }

    function _registerGroup(uint256 g, address steward) internal {
        vm.prank(steward);
        seal.setRoot(g, g == 0 ? root0 : root1);
    }

    function test_SetRootOnlyByOwnSteward() public {
        _registerGroup(0, stewards[0]);
        assertEq(seal.rootOf(0), root0, "root stored");
        vm.expectRevert(abi.encodeWithSelector(ChaupalSeal.NotSteward.selector, 0));
        vm.prank(mallory);
        seal.setRoot(0, root0);
    }

    function test_SetRootCrossGroupReverts() public {
        _registerGroup(0, stewards[0]);
        vm.expectRevert(abi.encodeWithSelector(ChaupalSeal.NotSteward.selector, 1));
        vm.prank(stewards[0]);
        seal.setRoot(1, root1);
    }

    function test_RevertIfRootNotSetYet() public {
        vm.prank(members0[0]);
        vm.expectRevert(abi.encodeWithSelector(ChaupalSeal.RootNotSet.selector, 0));
        seal.claim(0, proofs0[0]);
    }

    function test_MemberClaimsSeal() public {
        _registerGroup(0, stewards[0]);
        vm.expectEmit(true, true, true, true, address(seal));
        emit ChaupalSeal.SealClaimed(1, 0, members0[0]);
        vm.prank(members0[0]);
        uint256 tokenId = seal.claim(0, proofs0[0]);
        assertEq(tokenId, 1, "first token id");
        assertEq(seal.ownerOf(tokenId), members0[0], "owner is member");
        assertTrue(seal.isClaimed(0, members0[0]), "claimed flag set");
        assertEq(seal.groupOf(tokenId), 0, "token bound to group");
        assertEq(seal.balanceOf(members0[0]), 1, "balance 1");
    }

    function test_SecondMemberAlsoClaims() public {
        _registerGroup(0, stewards[0]);
        vm.prank(members0[0]);
        seal.claim(0, proofs0[0]);
        vm.prank(members0[1]);
        seal.claim(0, proofs0[1]);
        assertEq(seal.balanceOf(members0[1]), 1, "second member minted");
    }

    function test_SecondClaimBySameMemberReverts() public {
        _registerGroup(0, stewards[0]);
        vm.prank(members0[0]);
        seal.claim(0, proofs0[0]);
        vm.expectRevert(abi.encodeWithSelector(ChaupalSeal.AlreadyClaimed.selector, 0, members0[0]));
        vm.prank(members0[0]);
        seal.claim(0, proofs0[0]);
    }

    function test_NonMemberReverts() public {
        _registerGroup(0, stewards[0]);
        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(ChaupalSeal.NotInMerkleTree.selector, 0, mallory));
        seal.claim(0, proofs0[0]);
    }

    function test_MemberUsingForeignKeyReverts() public {
        _registerGroup(0, stewards[0]);
        _registerGroup(1, stewards[1]);
        vm.prank(members0[0]);
        vm.expectRevert(abi.encodeWithSelector(ChaupalSeal.NotInMerkleTree.selector, 1, members0[0]));
        seal.claim(1, proofs0[0]);
    }

    function test_CrossGroupProofDoesNotVerify() public {
        _registerGroup(0, stewards[0]);
        _registerGroup(1, stewards[1]);
        string memory f1 = vm.readFile("./data/forge/group-1.json");
        address member1 = vm.parseJsonAddress(f1, ".members[3].a");
        bytes32[] memory proof1 = vm.parseJsonBytes32Array(f1, ".members[3].p");
        vm.prank(member1);
        vm.expectRevert(abi.encodeWithSelector(ChaupalSeal.NotInMerkleTree.selector, 0, member1));
        seal.claim(0, proof1);
    }

    function test_UnregisteredGroupReverts() public {
        vm.prank(members0[0]);
        vm.expectRevert(abi.encodeWithSelector(ChaupalSeal.GroupNotRegistered.selector, 12));
        seal.claim(12, proofs0[0]);
    }

    function test_TransferBlocked() public {
        _registerGroup(0, stewards[0]);
        vm.prank(members0[0]);
        uint256 tokenId = seal.claim(0, proofs0[0]);

        vm.prank(members0[0]);
        vm.expectRevert(ChaupalSeal.Soulbound.selector);
        seal.transferFrom(members0[0], alice, tokenId);

        vm.prank(members0[0]);
        vm.expectRevert(ChaupalSeal.Soulbound.selector);
        seal.safeTransferFrom(members0[0], bob, tokenId);

        vm.prank(members0[0]);
        seal.approve(alice, tokenId);
        vm.prank(alice);
        vm.expectRevert(ChaupalSeal.Soulbound.selector);
        seal.transferFrom(members0[0], alice, tokenId);
    }

    function test_RevertIfZeroStewardInConstructor() public {
        vm.expectRevert(abi.encodeWithSelector(ChaupalSeal.GroupNotRegistered.selector, 5));
        address[12] memory bad = stewards;
        bad[5] = address(0);
        new ChaupalSeal(bad);
    }

    function test_StewardCanRotateRootOngoing() public {
        _registerGroup(0, stewards[0]);
        vm.prank(members0[0]);
        seal.claim(0, proofs0[0]);

        bytes32 unknownRoot = bytes32(uint256(0xdeadbeef));
        vm.prank(stewards[0]);
        seal.setRoot(0, unknownRoot);
        assertEq(seal.rootOf(0), unknownRoot, "root rotated by steward post-deploy");

        vm.prank(members0[1]);
        vm.expectRevert(abi.encodeWithSelector(ChaupalSeal.NotInMerkleTree.selector, 0, members0[1]));
        seal.claim(0, proofs0[1]);

        _registerGroup(0, stewards[0]);
        vm.prank(members0[1]);
        uint256 tokenId = seal.claim(0, proofs0[1]);
        assertEq(seal.groupOf(tokenId), 0, "member claims under restored root");
    }

    function test_AllTwelveGroupsClaimOnChain() public {
        address lastMember;
        for (uint256 g = 0; g < 12; g++) {
            string memory f = vm.readFile(string.concat("./data/forge/group-", vm.toString(g), ".json"));
            bytes32 root = vm.parseJsonBytes32(f, ".root");
            vm.prank(stewards[g]);
            seal.setRoot(g, root);

            address member = vm.parseJsonAddress(f, ".members[0].a");
            bytes32[] memory proof = vm.parseJsonBytes32Array(f, ".members[0].p");
            vm.prank(member);
            uint256 tokenId = seal.claim(g, proof);
            lastMember = member;
            assertEq(seal.groupOf(tokenId), g, "token bound to group");
            assertTrue(seal.isClaimed(g, member), "member claimed");
        }
        assertEq(seal.ownerOf(12), lastMember, "12th token minted to group 11 member");
    }

    function test_ConstructedSealIsNotSoulboundNoop() public view {
        assertEq(seal.MAX_GROUPS(), 12);
        assertEq(seal.stewardOf(3), stewards[3]);
    }
}
