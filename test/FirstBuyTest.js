const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployUniswapContracts } = require("../scripts/utils/uniswap");
const hre = require("hardhat");

describe("UniswapFirstBuy Contract", function () {
  let uniswapFirstBuy, owner, addr1, addr2, addr3, token, mockAllowlist;
  let taxAmount = 50; // 5% tax

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    // Deploy Mock Contracts for ITaxToken, IUniswapV2Router02, and IAllowlist here
    // Assume these mocks are already created for demonstration
    [factory, router, weth] = await deployUniswapContracts(owner);

    Token = await ethers.getContractFactory("TestUniswapTaxToken");

    token = await Token.deploy(router.address, taxAmount);
    await token.deployed();

    const AllowlistContract = await hre.ethers.getContractFactory("Allowlist");
    mockAllowlist = await AllowlistContract.deploy();
    await mockAllowlist.deployed();

    // Deploy UniswapFirstBuy
    const UniswapFirstBuy = await ethers.getContractFactory("UniswapFirstBuy");
    uniswapFirstBuy = await UniswapFirstBuy.deploy(router.address);

    // Initialize the contract with necessary addresses
    await uniswapFirstBuy.setTokenAddress(token.address);
    // await uniswapFirstBuy.setFirstBuyAllowlist(mockAllowlist.address);
    // await uniswapFirstBuy.setMaxContribution(ethers.utils.parseEther("0.1"));
  });

  describe("ETH Contributions", function () {
    it("Should allow users on the allowlist to contribute ETH within the limit", async function () {
      // Assuming addr1 is on the allowlist
      // await mockAllowlist.addToAllowlist([addr1.address]);

      // addr1 sends ETH
      await expect(
        addr1.sendTransaction({
          to: uniswapFirstBuy.address,
          value: ethers.utils.parseEther("0.05"), // within max contribution
        })
      ).to.not.be.reverted;

      // Verify the contribution
      const contribution = await uniswapFirstBuy.ethContributions(
        addr1.address
      );
      expect(contribution).to.equal(ethers.utils.parseEther("0.05"));
    });

    // Other tests like exceeding contribution, not on allowlist, etc.
  });

  describe("Launch and Liquidity Addition", function () {
    it("Should allow the owner to launch the token and add liquidity", async function () {
      let addys = [addr1, addr2, addr3];
      // await mockAllowlist.addToAllowlist(addys.map(a => a.address));

      for (let i = 0; i < addys.length; i++) {
        addy = addys[i];
        await addy.sendTransaction({
          to: uniswapFirstBuy.address,
          value: ethers.utils.parseEther("0.1"),
        });
      }
      // Close the contribution window
      // await uniswapFirstBuy.setIsOpen(false);

      // Launch the token
      let numTokens = ethers.utils.parseEther("1000000");
      await token.connect(owner).approve(uniswapFirstBuy.address, numTokens);
      let ethAmountToAdd = ethers.utils.parseEther("1"); // 8 ETH

      // await token.transferOwnership(uniswapFirstBuy.address);

      await uniswapFirstBuy.launchToken(numTokens, { value: ethAmountToAdd });

      await uniswapFirstBuy.connect(addr1).withdrawTokens();
      console.log("got tokens", await token.balanceOf(addr1.address));

      // Check if liquidity was added
      expect(await uniswapFirstBuy.isLiquidityAdded()).to.be.true;
    });

    // Additional tests for conditions around launch
  });

  describe("Edge Cases and Security", function () {
    // Example: Testing contribution beyond the limit
    it("Should reject contributions beyond the maximum limit", async function () {
      // Setup for this test...
      // await mockAllowlist.addToAllowlist([addr1.address]);

      // addr1 sends ETH
      await expect(
        addr1.sendTransaction({
          to: uniswapFirstBuy.address,
          value: ethers.utils.parseEther("0.6"), // within max contribution
        })
      ).to.be.revertedWith("Contribution exceeds limit");
    });
  });

  describe("Emergency Withdraw", function () {
    it("Should only be callable by the owner", async function () {
      // Attempt to call emergencyWithdraw from a non-owner account
      await expect(
        uniswapFirstBuy.connect(addr1).emergencyWithdraw()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should transfer the entire balance to the owner", async function () {
      // Send ETH to the contract to simulate balance
      const initialOwnerBalance = await ethers.provider.getBalance(
        owner.address
      );
      const sendValue = ethers.utils.parseEther("0.5");
      await owner.sendTransaction({
        to: uniswapFirstBuy.address,
        value: sendValue,
      });

      // Check the contract's balance before withdrawal
      const initialContractBalance = await ethers.provider.getBalance(
        uniswapFirstBuy.address
      );
      expect(initialContractBalance).to.equal(sendValue);

      // Call emergencyWithdraw as the owner
      await uniswapFirstBuy.connect(owner).emergencyWithdraw();

      // Check the contract's balance after withdrawal
      const finalContractBalance = await ethers.provider.getBalance(
        uniswapFirstBuy.address
      );
      expect(finalContractBalance).to.equal(0);

      // The owner's balance should have increased by approximately 1 ETH
      // Note: This check is approximate due to gas costs
      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
      expect(finalOwnerBalance).to.be.closeTo(
        initialOwnerBalance,
        ethers.utils.parseEther("0.01")
      );
    });
  });
});
