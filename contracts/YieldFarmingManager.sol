// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./PeriPeriGov.sol";

contract YieldFarmingManager is Context, Ownable {
    using SafeMath for uint256;

    struct UserInfo {
        uint256 amountLPToken;
        uint256 pastRewardToBeExcluded;
    }

    struct PoolInfo {
        IERC20 lpTokenAddress;
        uint256 poolRewardPerBlock;
        uint256 lastRewardBlock;
        uint256 accruedRewardPerUnitOfPoolToken;
    }

    PeriPeriGov public governanceToken;

    uint256 public rewardPerBlock;

    uint256 public rewardStartingBlock;

    uint256 public rewardEndingBlock;

    PoolInfo[] public poolInfo;

    mapping (uint256 => mapping (address => UserInfo)) public userInfo;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(
        PeriPeriGov _governanceToken,
        uint256 _rewardStartingBlock,
        uint256 _rewardEndingBlock,
        uint256 _rewardPerBlock
    ) {
        governanceToken = _governanceToken;
        rewardStartingBlock = _rewardStartingBlock;
        rewardEndingBlock = _rewardEndingBlock;
        rewardPerBlock = _rewardPerBlock;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    function addPool(IERC20 _poolAddress) public onlyOwner {
        uint256 _lastRewardBlock = block.number > rewardStartingBlock ? block.number : rewardStartingBlock;

        poolInfo.push(PoolInfo({
            lpTokenAddress: _poolAddress,
            poolRewardPerBlock: 1,
            lastRewardBlock: _lastRewardBlock,
            accruedRewardPerUnitOfPoolToken: 0
        }));
    }

    function deposit(uint256 _poolId, uint256 _amount) public {
        require(_amount > 0, "Can only deposit positive amounts");
        PoolInfo storage _poolInfo = poolInfo[_poolId];
        UserInfo storage _userInfo = userInfo[_poolId][_msgSender()];
        updatePool(_poolId);
        if (_userInfo.amountLPToken > 0) {
            // pending user reward is the existing lp amount multiplied by the accrued reward per unit of LP, exluding the already calculated past reward
            uint256 _pendingUserReward = _userInfo.amountLPToken.mul(_poolInfo.accruedRewardPerUnitOfPoolToken).sub(_userInfo.pastRewardToBeExcluded);
            if (_pendingUserReward > 0) {
                governanceToken.transfer(msg.sender, _pendingUserReward);
            }
        }
        _poolInfo.lpTokenAddress.transferFrom(msg.sender, address(this), _amount);
        _userInfo.amountLPToken = _userInfo.amountLPToken.add(_amount);

        // Reward to be excluded in the next reward calculation
        _userInfo.pastRewardToBeExcluded = _userInfo.amountLPToken.mul(_poolInfo.accruedRewardPerUnitOfPoolToken);
        emit Deposit(msg.sender, _poolId, _amount);
    }

    function withdraw(uint256 _poolId, uint256 _amount) public {
        require(_amount > 0, "You can only withdraw positive amounts");
        PoolInfo storage _poolInfo = poolInfo[_poolId];
        UserInfo storage _userInfo = userInfo[_poolId][_msgSender()];
        require(_amount >= _userInfo.amountLPToken, "Only withdraw what you have");
        updatePool(_poolId);
        uint256 _pendingUserReward = _userInfo.amountLPToken.mul(_poolInfo.accruedRewardPerUnitOfPoolToken).sub(_userInfo.pastRewardToBeExcluded);
        if (_pendingUserReward > 0) {
                governanceToken.transfer(msg.sender, _pendingUserReward);
        }
        _userInfo.amountLPToken = _userInfo.amountLPToken.sub(_amount);
        _poolInfo.lpTokenAddress.transfer(msg.sender, _amount);

        _userInfo.pastRewardToBeExcluded = _userInfo.amountLPToken.mul(_poolInfo.accruedRewardPerUnitOfPoolToken);
        emit Withdraw(msg.sender, _poolId, _amount);
        
    }

    function updatePool(uint256 _poolId) public {
        uint256 _blockNumber = block.number;
        PoolInfo storage _poolInfo = poolInfo[_poolId];
        if (_blockNumber <= _poolInfo.lastRewardBlock) {
            return;
        }
        uint256 _lpTokenSupply = _poolInfo.lpTokenAddress.balanceOf(address(this));
        if (_lpTokenSupply == 0) {
            _poolInfo.lastRewardBlock = _blockNumber;
            return;
        }
        uint256 _accruedReward = getAccruedReward(_poolInfo.lastRewardBlock, _blockNumber);
        _poolInfo.accruedRewardPerUnitOfPoolToken = _accruedReward.div(_lpTokenSupply);
        _poolInfo.lastRewardBlock = _blockNumber;
    }

    function calculatePendingRewards(uint256 _poolId, address _user) public view returns (uint256) {
        PoolInfo storage _poolInfo = poolInfo[_poolId];
        UserInfo storage _userInfo = userInfo[_poolId][_user];
        uint256 _accruedRewardPerUnitOfLP = _poolInfo.accruedRewardPerUnitOfPoolToken;
        uint256 _lpSupply = _poolInfo.lpTokenAddress.balanceOf(address(this));
        if (block.number > _poolInfo.lastRewardBlock && _lpSupply > 0) {
            uint256 _accruedReward = getAccruedReward(_poolInfo.lastRewardBlock, block.number);
            _accruedRewardPerUnitOfLP = _poolInfo.accruedRewardPerUnitOfPoolToken.add(_accruedReward.div(_lpSupply));
        }
        return _userInfo.amountLPToken.mul(_accruedRewardPerUnitOfLP).sub(_userInfo.pastRewardToBeExcluded);
    }

    function getAccruedReward(uint256 _blockFrom, uint256 _blockTo) public view returns (uint256) {
        require(_blockFrom <= _blockTo, "BlockFrom must be lower or equal to BlockTo");
        if (_blockFrom >= rewardEndingBlock) {
            return 0;
        } else if (_blockTo >= rewardEndingBlock) {
            return rewardPerBlock.mul(rewardEndingBlock.sub(_blockFrom));
        } else {
            return rewardPerBlock.mul(_blockTo.sub(_blockFrom));
        }
    }
}