import { ethers } from 'hardhat';

async function main() {
  
  const PeriPeriGov = await ethers.getContractFactory("PeriPeriGov");
  const ppgov = await PeriPeriGov.deploy(ethers.utils.parseEther("1000"));
  await ppgov.deployed();

  const network = await ethers.provider.getNetwork();

  console.log("PeriPeriGov deployed at: %s on network %s", ppgov.address, network.name);

  const YieldFarmingManager = await ethers.getContractFactory("YieldFarmingManager");
  const yFManager = await YieldFarmingManager.deploy(ppgov.address, 0, 10, 1);
  await yFManager.deployed();

  console.log("YieldFarmingManager deployed at: %s on network %s", yFManager.address, network.name);

  const tx = await ppgov.transfer(yFManager.address, ethers.utils.parseEther("100"));

  console.log("Sent initial reward tokens to YieldFarmingManager. More details %s", tx.hash)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
