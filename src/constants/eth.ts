import { ethers, JsonRpcProvider } from "ethers";
import { loadEnv } from "../utils/loadEnv";

loadEnv();

export const provider = new JsonRpcProvider(process.env.RPC_URI!, 7700);
export const NFT_CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS!;

export const nftContract = new ethers.Contract(
    NFT_CONTRACT_ADDRESS,
    ["function balanceOf(address) external view returns (uint256)"],
    provider
);
