import { expect } from 'chai'
import { ethers, network } from 'hardhat'
import { Contract, Signer } from 'ethers'
import * as fs from 'fs';

describe("YieldFarmingManager", () => {
  let ppgov: Contract
  let yFManager: Contract
  let deployer: Signer
  let user: Signer

  beforeEach(async () => {
      const [owner, _user] = await ethers.getSigners()
      deployer = owner
      user = _user

      const PeriPeriGov = await ethers.getContractFactory("PeriPeriGov")
      ppgov = await PeriPeriGov.deploy(ethers.utils.parseEther("1000"))
      await ppgov.deployed()
  
      const YieldFarmingManager = await ethers.getContractFactory("YieldFarmingManager")
      yFManager = await YieldFarmingManager.deploy(ppgov.address, 20, 30, 1)
      await yFManager.deployed()

      await ppgov.transfer(yFManager.address, ethers.utils.parseEther("100"))
  })

  describe("Deployment", () => {
    it("Should successfully deploy contract", async () => {
      expect(await yFManager.governanceToken()).to.equal(ppgov.address)
      expect(await ppgov.balanceOf(yFManager.address)).to.equal(ethers.utils.parseEther("100"))
      expect(await yFManager.rewardStartingBlock()).to.equal(20)
      expect(await yFManager.rewardEndingBlock()).to.equal(30)
      expect(await yFManager.rewardPerBlock()).to.equal(1)
    });
  })

  describe("Add Pool", () => {
    it("Should successfully add pool", async () => {
      expect(await yFManager.poolLength()).to.equal(0)
      await yFManager.addPool(ethers.utils.getAddress('0xfdb2786d5ac6ef456b87c0506db9fcb47cae711a'))

      // now pool should have one element
      expect(await yFManager.poolLength()).to.equal(1)

      const addedPool = await yFManager.poolInfo(0)
      expect(addedPool.lpTokenAddress).to.equal(ethers.utils.getAddress('0xfdb2786d5ac6ef456b87c0506db9fcb47cae711a'))
      expect(addedPool.poolRewardPerBlock).to.equal(1)
      //expect(addedPool.lastRewardBlock).to.equal(20)
      expect(addedPool.accruedRewardPerUnitOfPoolToken).to.equal(0)
    })

    it("Pool can only be added by owner", async () => {
      await expect(yFManager.connect(user).addPool(ethers.utils.getAddress('0xfdb2786d5ac6ef456b87c0506db9fcb47cae711a'))).to.be.reverted
    })
  })

  describe("Deposit", () => {
    it("Should successfully deposit pool token", async () => {
      const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
      const uniswapV2Router02Address = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
      const uniswapV2FactoryAddress = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"
      const uniswapV2Router02Abi = JSON.parse(fs.readFileSync('contracts/artifacts/UniswapV2Router02.json').toString())
      const uniswapV2FactoryAbi = JSON.parse(fs.readFileSync('contracts/artifacts/UniswapV2Factory.json').toString())
      const uniswapV2ERC20Abi = JSON.parse(fs.readFileSync('contracts/artifacts/IUniswapV2ERC20.json').toString())

      const uniswapV2Router02 = new ethers.Contract(uniswapV2Router02Address, uniswapV2Router02Abi)
      const uniswapV2Factory = new ethers.Contract(uniswapV2FactoryAddress, uniswapV2FactoryAbi)

      // impersonate an account to be used for testing
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0xcA8Fa8f0b631EcdB18Cda619C4Fc9d197c8aFfCa"],
      });

      const signer = await ethers.getSigner("0xcA8Fa8f0b631EcdB18Cda619C4Fc9d197c8aFfCa")
      const signerAddress = await signer.getAddress()

      // transfer some governance token
      await ppgov.transfer(signerAddress, ethers.utils.parseEther("10"))
      
      // create UNI pair
      const createPairTx = await uniswapV2Factory.connect(signer).createPair(ethers.utils.getAddress(WETH), ppgov.address)
      await createPairTx.wait()
      const pair = await uniswapV2Factory.connect(signer).getPair(ethers.utils.getAddress(WETH), ppgov.address)
      const pairContract = new ethers.Contract(ethers.utils.getAddress(pair), uniswapV2ERC20Abi)

      // add liquidity
      await ppgov.connect(signer).approve(uniswapV2Router02.address, ethers.utils.parseEther("10"))
      await uniswapV2Router02.connect(signer).addLiquidityETH(
        ppgov.address, 
        ethers.utils.parseEther("5"), 
        ethers.utils.parseEther("4.9"), 
        ethers.utils.parseEther("0.9"), 
        signerAddress, 
        1923532598,
        { value: ethers.utils.parseEther("1") }
      )

      const balance = await pairContract.connect(signer).balanceOf(signerAddress)
      console.log("Balance ", ethers.utils.formatEther(balance))

      // add pool into YFManager
      await yFManager.addPool(pairContract.address)

      await pairContract.connect(signer).approve(yFManager.address, ethers.utils.parseEther("2"))
      await yFManager.connect(signer).deposit(0, ethers.utils.parseEther("1"))

      expect(await yFManager.getUserLPBalance(0, signerAddress)).to.equal(ethers.utils.parseEther("1"))
      const poolInfo = await yFManager.getPoolDetails(0)
      expect(poolInfo.lpTokenAddress).to.equal(pairContract.address)
    })

    it("Should reject 0 amount deposits", async () => {
      await expect(yFManager.deposit(0, 0)).to.be.revertedWith('Can only deposit positive amounts')
    })
  })
});