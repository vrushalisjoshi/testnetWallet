var Web3 = require("web3");
var web3 = new Web3();
var fs = require("fs");
const Tx = require('ethereumjs-tx');
var contractABI = require('./ABI');
const InputDataDecoder = require('ethereum-input-data-decoder');
const decoder = new InputDataDecoder(contractABI);
web3.setProvider(new web3.providers.HttpProvider('https://rinkeby.infura.io/v3/146248320ef24011ba96ed4ee2b5fd57'));

var strMessage;

var appRouter = function (app) {
    app.get('/', (req, res) => {
        res.json({ "message": "Check Wallet API" });
    });

    app.get('/api/new_wallet/:words', async function (req, res) {
        var words = req.params.words;
        var resultObject = await add(words);
        return res.send(resultObject);
    });
    async function add(words) {
        try {
            var result = await web3.eth.accounts.create(words);
            return {
                walletAddress: result.address,
                privateKey: result.privateKey
            };
        }

        catch (e) {
            console.error(e);
        }
    }
    app.get('/api/recoverWallet/:pvtKey', async function (req, res) {
        const pvtKey = req.params.pvtKey;

        var resultObject = await getEtherAddress(pvtKey);
        return res.send(resultObject);
    });
    async function getEtherAddress(pvtKey) {
        try {
            const createKeccakHash = require('keccak');
            const secp256k1 = require('secp256k1');
            const privateKey = new Buffer(pvtKey, 'hex');
            let pubKey = secp256k1.publicKeyCreate(privateKey, false).slice(1);
            let address = createKeccakHash('keccak256').update(pubKey).digest().slice(-20).toString('hex');
            return {
                walletAddress: '0x' + address
            };
        }

        catch (e) {
            console.error(e);
        }
    }

    app.get('/api/getTransaction/:txHash', async function (req, res) {
        const txHash = req.params.txHash;

        var resultObject = await getTransaction(txHash);
        return res.send(resultObject);
    });
    async function getTransaction(txHash) {
        try {
            var receipt = await web3.eth.getTransaction(txHash)
            // console.log(receipt);
            // if (web3.eth.getTransactionReceipt(txHash).blockNumber == undefined) {
            //     return {
            //         "receipt": receipt,
            //         "status": "Invalid"

            //     };
            // }
            if (receipt != null) {
                if (receipt.blockNumber == null) {
                    return {
                        "receipt": receipt,
                        "status": "pending"
                    };
                }
                var block = await web3.eth.getBlock(receipt['blockNumber']);
                var timestamp = await block.timestamp * 1000;
                const result = await decoder.decodeData(receipt.input);
                // console.log(result);
                if (result.name != null) {
                    var token_numbers = result.inputs[1].toString() / Math.pow(10, 18);
                    // console.log(block);
                    // console.log(web3.eth.abi.decodeParameters(['address', 'address'], '0xa9059cbb00000000000000000000000097d64ff68686665a5e47f22567820140cc2ff53b0000000000000000000000000000000000000000000000008ac7230489e80000'));
                    return {
                        "token_numbers": token_numbers,
                        "date": (new Date(timestamp)).toUTCString(),
                        "receipt": receipt,
                        "status": "success"
                    };
                }
                else {
                    return {
                        "receipt": receipt,
                        "status": "Failed"
                    };
                }
            }
            else {
                return {
                    "receipt": receipt,
                    "status": "Invalid"

                };
            }
        }

        catch (e) {
            console.error(e);
        }
    }

    app.get('/api/etherBalance/:contract/:walletAddress', async function (req, res) {
        const contract = req.params.contract;
        const walletAddress = req.params.walletAddress;

        var resultObject = await check_eth_bal(contract, walletAddress);
        return res.send(resultObject);
    });

    async function check_eth_bal(contract, walletAddress) {
        try {
            var tokenContract = new web3.eth.Contract(contractABI, contract);
            var decimal = await tokenContract.methods.decimals().call();
            var bal = await web3.eth.getBalance(walletAddress);
            return {
                etherBalance: bal / Math.pow(10, decimal)
            }
        }

        catch (e) {
            console.error(e);
        }

    }

    app.get('/api/token/:contract/:etheraddress/:choice', async function (req, res) {
        const contract = req.params.contract;
        const etheraddress = req.params.etheraddress;
        const choice = req.params.choice;

        var resultObject = await check_token_bal(contract, etheraddress, choice);
        return res.send(resultObject);
    })
    async function check_token_bal(contractAddress, etherAddress, choice) {
        try {
            var tokenContract = new web3.eth.Contract(contractABI, contractAddress);
            var decimal = await tokenContract.methods.decimals().call();;
            var balance = await tokenContract.methods.balanceOf(etherAddress).call();
            var adjustedBalance = await balance / Math.pow(10, decimal);
            var tokenName = await tokenContract.methods.name().call();
            var tokenSymbol = await tokenContract.methods.symbol().call();
            var tokenSupply = await tokenContract.methods.totalSupply().call();
            var adjustedSupplyBalance = await tokenSupply / Math.pow(10, decimal);
            switch (choice) {
                case "tokenName":
                    return {
                        status: 200,
                        message: 'Token Name:',
                        res: tokenName
                    };
                    break;
                case "tokenSymbol":
                    return {
                        status: 200,
                        message: 'Token Symbol:',
                        res: tokenSymbol
                    };
                    break;
                case "totalSupply":
                    return {
                        status: 200,
                        message: 'Total Supply:',
                        res: adjustedSupplyBalance
                    };
                    break;
                case "totalBalance":
                    return {
                        status: 200,
                        message: 'Total Balance:',
                        res: adjustedBalance
                    };
                    break;
                case "allDetails":
                    return {
                        status: 200,
                        message: 'All Details',
                        res: { tokenName, tokenSymbol, adjustedBalance, adjustedSupplyBalance }
                    }
                    break;
                default:
                    return {
                        status: 404,
                        message: 'Bad Request for Web3',
                    };
            }
        }
        catch (e) {
            console.error(e);
            return {
                status: 404,
                message: 'Bad Request General.'
            };
        }
    }

    app.get('/api/transfer/:contractAddress/:fromAddress/:toAddress/:keyPrivate/:amount', async function (req, res) {
        try {
            const ethContract = req.params.contractAddress;
            const fromAddress = req.params.fromAddress;
            const toAddress = req.params.toAddress;
            const keyPrivate = req.params.keyPrivate;
            const amount = req.params.amount;

            privateKey = Buffer.from(keyPrivate, 'hex');

            var abiArray = JSON.parse(fs.readFileSync('ABI.json', 'utf-8'));

            var contract = new web3.eth.Contract(abiArray, ethContract);

            await web3.eth.getTransactionCount(fromAddress, (err, txCount) => {

                const txObject = {
                    nonce: web3.utils.toHex(txCount),
                    gasLimit: web3.utils.toHex(800000), // Raise the gas limit to a much higher amount
                    gasPrice: web3.utils.toHex(web3.utils.toWei('10', 'gwei')),
                    to: ethContract,
                    data: contract.methods.transfer(toAddress, web3.utils.toHex(amount * 1000000000000000000)).encodeABI()
                }

                const tx = new Tx(txObject);
                tx.sign(privateKey);

                const serializedTx = tx.serialize();
                const raw = '0x' + serializedTx.toString('hex');

                web3.eth.sendSignedTransaction(raw, async (err, txHash) => {
                    if (!err) {
                        console.log("Tx Hash:" + txHash);
                        strMessage = txHash;
                        res.send({
                            status: 200,
                            message: 'Tx Hash:',
                            res: strMessage
                        });
                    }
                    else {
                        console.log("Tx Error:" + err);
                        strMessage = err;
                        res.send({
                            status: 404,
                            message: 'Error:',
                            res: strMessage
                        });
                    }
                })
            })
        }
        catch (e) {
            console.error(e);
        }

    })

    app.get('/api/etherTransfer/:fromAddress/:toAddress/:keyPrivate/:amount', async function (req, res) {
        try {
            const fromAddress = req.params.fromAddress;
            const toAddress = req.params.toAddress;
            const keyPrivate = req.params.keyPrivate;
            const amount = req.params.amount;

            privateKey = Buffer.from(keyPrivate, 'hex');

            var gasPrice = 2;
            var gasLimit = 3000000;

            await web3.eth.getTransactionCount(fromAddress, (err, txCount) => {

                const txObject = {
                    nonce: web3.utils.toHex(txCount),
                    "from": fromAddress,
                    "gasPrice": web3.utils.toHex(gasPrice * 1e9),
                    "gasLimit": web3.utils.toHex(gasLimit),
                    "to": toAddress,
                    "value": web3.utils.toHex(amount * 1000000000000000000),
                    "chainId": 4
                }

                const tx = new Tx(txObject);
                tx.sign(privateKey);

                const serializedTx = tx.serialize();
                const raw = '0x' + serializedTx.toString('hex');

                web3.eth.sendSignedTransaction(raw, async (err, txHash) => {
                    if (!err) {
                        console.log("Tx Hash:" + txHash);
                        strMessage = txHash;
                        res.send({
                            status: 200,
                            message: 'Tx Hash:',
                            res: strMessage
                        });
                    }
                    else {
                        console.log("Tx Error:" + err);
                        strMessage = err;
                        res.send({
                            status: 404,
                            message: 'Error:',
                            res: strMessage
                        });
                    }
                })
            })
        }
        catch (e) {
            console.error(e);
        }

    })

}
module.exports = appRouter;

