const hre = require("hardhat");
const ethers = hre.ethers;

const path = require('path');

const web3 = require('web3');

async function main() {

  // Retrieve signers from Hardhat (as defined in the hardhat.config.js file).
  const [signer1, signer2, signer3] = await ethers.getSigners();

  // Pick the deployer (default is signer1).
  const signer = signer1;
  console.log("Signer is:", signer.address);

  // TODO: adjust as needed.
  pathToABI = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "StateChannel.sol",
    "StateChannel.json"
  );

  const ABI = require(pathToABI).abi;
  // console.log(ABI);

  // Contract address of the payment channel.
  const contractAddr = '0x44315DE282695e32287A5a9B8317cA75c55e008A';
  
  // Create contract with attached signer.
  const contract = new ethers.Contract(contractAddr, ABI, signer);

  const getSignature = async (amount) => {

    // Keccack256 hash the solidity encode packed address and ETH amount.
    // Hint: https://docs.ethers.org/v6/api/hashing/#solidityPackedKeccak256
    const hashedMsg = ethers.solidityPackedKeccak256(
        ['uint', 'address'], 
        [amount, contractAddr]
      );
      // console.log('Hashed msg', hashedMsg);
      
      // Transform to Bytes array before signining.
      const hashedArray = ethers.toBeArray(hashedMsg);
      // console.log('Hashed array', hashedArray);

      // Sign.
      const signature = await signer.signMessage(hashedArray);
      // console.log('signMessage hashed', signature);
    
      return signature;
  };

  const sendSignature = async (idx, amount) => {
    let sig = await getSignature(amount);
    let tx = await contract.addSignature(idx, sig, amount);
    await tx.wait();
  };

  console.log('Adding signatures.');

  await sendSignature(0, 200);
  await sendSignature(1, 100);  

  console.log('Signatures added.');

  let s = await contract.getSignature(0);
  console.log('Sig 0', s);
  s = await contract.getSignatureEthAmount(0);
  console.log('Eth 0', s);

  s = await contract.getSignature(1);
  console.log('Sig 1', s);
  s = await contract.getSignatureEthAmount(1);
  console.log('Eth 1', s);
  
}


main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});