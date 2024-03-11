const { expect } = require("chai");
const { ethers } = require("hardhat");
const factoryArtifact = require("@uniswap/v2-core/build/UniswapV2Factory.json");
const routerArtifact = require("@uniswap/v2-periphery/build/UniswapV2Router02.json");
const pairArtifact = require("@uniswap/v2-periphery/build/IUniswapV2Pair.json");
const { Contract } = require("ethers");

async function deployUniswapContracts(owner) {
  const WETH = await ethers.getContractFactory("WETH9");
  const weth = await WETH.deploy();

  const Factory = new ethers.ContractFactory(
    factoryArtifact.abi,
    factoryArtifact.bytecode,
    owner
  );
  const factory = await Factory.deploy(owner.address);

  const Router = new ethers.ContractFactory(
    routerArtifact.abi,
    routerArtifact.bytecode,
    owner
  );
  const router = await Router.deploy(factory.target, weth.target);

  return [factory, router, weth];
}

describe("UniswapFirstBuyHandling", function () {
  let UniswapFirstBuy;
  let uniswapFirstBuy;
  let UniswapFirstBuyHandling;
  let uniswapFirstBuyHandling;
  let FairToken;
  let fairToken;
  let FairStaking;
  let fairStaking;
  let owner;
  let addr1;
  let addr2;
  let addrs;
  let router;
  let weth;

  beforeEach(async function () {
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    [factory, router, weth] = await deployUniswapContracts(owner);

    FairToken = await ethers.getContractFactory("Fair");
    fairToken = await FairToken.deploy(router);

    UniswapFirstBuy = await ethers.getContractFactory("UniswapFirstBuy");
    uniswapFirstBuy = await UniswapFirstBuy.deploy(router);

    UniswapFirstBuyHandling = await ethers.getContractFactory(
      "UniswapFirstBuyHandling"
    );
    uniswapFirstBuyHandling = await UniswapFirstBuyHandling.deploy(
      router,
      uniswapFirstBuy
    );

    await uniswapFirstBuyHandling.setTokenAddress(fairToken);
  });

  describe("FairToken Deployment", function () {
    it("Should deploy FairToken with the correct initial supply", async function () {
      const totalSupply = await fairToken.totalSupply();
      expect(totalSupply).to.equal(888000000000000000000000000n);
    });
  });

  describe("Buy Tokens Uniswap First Buy", function () {
    it("Should allow the owner to launch the token and add liquidity", async function () {
      await addr1.sendTransaction({
        to: uniswapFirstBuy,
        value: ethers.parseEther("0.5"),
      });

      await addr2.sendTransaction({
        to: uniswapFirstBuy,
        value: ethers.parseEther("0.5"),
      });

      await owner.sendTransaction({
        to: uniswapFirstBuyHandling,
        value: ethers.parseEther("1"),
      });

      let numTokens = ethers.parseEther("0.000000001");
      await fairToken
        .connect(owner)
        .approve(uniswapFirstBuyHandling, numTokens);
      let ethAmountToAdd = ethers.parseEther("1");

      await fairToken.transferOwnership(uniswapFirstBuyHandling);

      await uniswapFirstBuyHandling.launchToken(numTokens, {
        value: ethAmountToAdd,
      });

      await uniswapFirstBuyHandling.connect(addr1).withdrawTokens();
      console.log("got tokens", await fairToken.balanceOf(addr1));

      expect(await fairToken.balanceOf(addr1)).to.be.above(0);

      expect(await uniswapFirstBuyHandling.isLiquidityAdded()).to.be.true;

      await expect(
        uniswapFirstBuyHandling.connect(addr1).withdrawTokens()
      ).to.be.revertedWith("Tokens have been paid out");
    });
  });
});
