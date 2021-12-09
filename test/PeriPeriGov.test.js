const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PeriPeriGov", function () {
  it("Should successfully deploy contract", async function () {
    const [owner] = await ethers.getSigners();

    const PeriPeriGov = await ethers.getContractFactory("PeriPeriGov");
    const ppgov = await PeriPeriGov.deploy(ethers.utils.parseEther("100"));
    await ppgov.deployed();

    expect(await ppgov.name()).to.equal("PeriPeriGov");
    expect(await ppgov.symbol()).to.equal("PPGOV");
    expect(await ppgov.totalSupply()).to.equal(ethers.utils.parseEther("100"));
    expect(await ppgov.balanceOf(owner.address)).to.equal(ethers.utils.parseEther("100"));
  });
});
