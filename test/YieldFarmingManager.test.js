const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("YieldFarmingManager", function () {
    it("Should successfully deploy contract", async function () {
      const [owner] = await ethers.getSigners();

      const PeriPeriGov = await ethers.getContractFactory("PeriPeriGov");
      const ppgov = await PeriPeriGov.deploy(ethers.utils.parseEther("1000"));
      await ppgov.deployed();
  
      const YieldFarmingManager = await ethers.getContractFactory("YieldFarmingManager");
      const yFManager = await YieldFarmingManager.deploy(ppgov.address, 0, 10, 1);
      await yFManager.deployed();
  
      expect(await yFManager.governanceToken()).to.equal(ppgov.address);
    });
  });