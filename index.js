require('dotenv').config()
const express = require("express");

const app = express();

const PORT = process.env.PORT || 8000

const ethers = require('ethers')
const { BigNumber, utils } = ethers

//fc29f82a8df77aea7c64270e75ffe4c2a9bb9c4038f640fdb5b5a114ec24372a
//0xC4020Cc9C356364caC699267532caEc751BEA5aa

const provider = new ethers.providers.WebSocketProvider(`wss://sepolia.infura.io/ws/v3/${process.env.INFURA_ID}`)

const depositWallet = new ethers.Wallet(
  process.env.DEPOSIT_WALLET_PRIVATE_KEY,
  provider,
)

const main = async () => {
  const depositWalletAddress = await depositWallet.getAddress()
  console.log(`Watching for incoming tx to ${depositWalletAddress}…`)

  provider.on('pending', (txHash) => {
    try {
      provider.getTransaction(txHash).then((tx) => {
        if (tx === null) return

        const { from, to, value } = tx

        if (to === depositWalletAddress) {
          console.log(`Receiving ${utils.formatEther(value)} ETH from ${from}…`)

          console.log(
            `Waiting for ${process.env.CONFIRMATIONS_BEFORE_WITHDRAWAL} confirmations…`,
          )

          tx.wait(process.env.CONFIRMATIONS_BEFORE_WITHDRAWAL).then(
            async (_receipt) => {
              const currentBalance = await depositWallet.getBalance('latest')
              const gasPrice = await provider.getGasPrice()
              const gasLimit = 21000
              const maxGasFee = BigNumber.from(gasLimit).mul(gasPrice)

              const tx = {
                to: process.env.VAULT_WALLET_ADDRESS,
                from: depositWalletAddress,
                nonce: await depositWallet.getTransactionCount(),
                value: currentBalance.sub(maxGasFee),
                chainId: 11155111, // mainnet: 1
                gasPrice: gasPrice,
                gasLimit: gasLimit,
              }

              depositWallet.sendTransaction(tx).then(
                (_receipt) => {
                  console.log(
                    `Withdrew ${utils.formatEther(
                      currentBalance.sub(maxGasFee),
                    )} ETH to VAULT ${process.env.VAULT_WALLET_ADDRESS} ✅`,
                  )
                  if (require.main === module) {
                    main()
                  }
                },
                (reason) => {
                  console.error('Withdrawal failed', reason)
                  if (require.main === module) {
                    main()
                  }
                },
              )
            },
            (reason) => {
              console.error('Receival failed', reason)
              if (require.main === module) {
                main()
              }
            },
          )
        }
      })
    } catch (err) {
      console.error(err)
      if (require.main === module) {
        main()
      }
    }
  })
}

// app.get("/", (req, res) => {
  
//   if (require.main === module) {
//     main()
//   }

//   res.send("Auto Withdrawal workin on this site")
// })

app.listen(PORT, () => {
  if (require.main === module) {
    main()
  }
  console.log(`app running on port ${PORT}`)
});