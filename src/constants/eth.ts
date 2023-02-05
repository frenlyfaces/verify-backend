import { ethers } from "ethers";
import { JsonRpcProvider } from "ethers";
import { loadEnv } from "../utils/loadEnv";

loadEnv();

export const provider = new JsonRpcProvider(process.env.RPC_URI!, 7700);
export const NFT_CONTRACT_ADDRESS =
    "0x020bbfC79C96c22A8677df740379ecCc0297E52C";

export const nftContract = new ethers.Contract(
    NFT_CONTRACT_ADDRESS,
    ["function balanceOf(address) external view returns (uint256)"],
    provider
);
