import { GenericWallet } from "../../Wallet";
import { fGet, fPost } from "../../fetch";
import { Transaction } from '@dashevo/dashcore-lib';
import { convertChainsoToNativeUtxo } from '../../utils';

// https://jestersimpps.github.io/my-first-experience-with-bitpay-bitcore/
export default class Dash extends GenericWallet {
    async getBalance() {
        const { data: { confirmed_balance, unconfirmed_balance } } = await fGet(`https://chain.so/api/v2/get_address_balance/DASH/${this.publicKey}`);
        return { result: confirmed_balance }; // Balance in Dash
    }

    async sendTransaction(destination: string, amount: number) {
        if (!this.isValidAddress(destination)) {
            throw new Error("Invalid destination address");
        }

        const { data: { txs } } = await fGet(`https://chain.so/api/v2/get_tx_unspent/DASH/${this.publicKey}`);
        let totalBalance = 0;
        for (const currUtxo of txs) {
            totalBalance += +currUtxo.value;
        }

        if (totalBalance < amount) {
            throw new Error("Insufficient funds");
        }

        const dashTransaction: Transaction = new (Transaction as any)()
            .from(convertChainsoToNativeUtxo(txs, this.publicKey, true))
            .to(destination, Math.round(amount * 1E8))
            .change(this.publicKey)
            .sign(this.privateKey);

        if (dashTransaction.getSerializationError(undefined)) {
            const error = dashTransaction.getSerializationError(undefined);
            throw error;
        }

        try {
            const res = await fPost(process.env.DASH_RPC_URL, {
                "jsonrpc": "2.0",
                "method": "sendrawtransaction",
                "params": [
                    dashTransaction.serialize(false)
                ],
                "id": "getblock.io"
            }, {
                'Content-Type': 'application/json',
                'x-api-key': process.env.DASH_RPC_API_KEY
            })
            console.log(res)
            return { result: res.result };
        } catch (error) {
            console.error(error);
        }

    }
}