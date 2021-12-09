const hre = require("hardhat");

async function main() {
  
  const PeriPeriGov = await hre.ethers.getContractFactory("PeriPeriGov");
  const ppgov = await PeriPeriGov.deploy(hre.ethers.utils.parseEther("1000"));

  await ppgov.deployed();

  console.log("PeriPeriGov deployed to:", ppgov.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
