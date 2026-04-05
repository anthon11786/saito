const ModTemplate = require('../../lib/templates/modtemplate');
const SaitoHeader = require('../../lib/saito/ui/saito-header/saito-header');
const PeerService = require('saito-js/lib/peer_service').default;
const WitnessMain = require('./lib/main');
const WitnessHome = require('./index');

class Witness extends ModTemplate {
	constructor(app) {
		super(app);

		this.name = 'Witness';
		this.slug = 'witness';
		this.description = 'Proof-of-Existence — prove a document existed at a point in time, permanently on-chain.';
		this.categories = 'Utility';

		this.icon_fa = 'fa-solid fa-shield-halved';

		this.styles = ['/witness/css/witness.css'];

		this.social = {
			twitter: '@SaitoOfficial',
			title: 'Saito Witness — Proof of Existence',
			url: 'https://saito.io/witness/',
			description: 'Prove any document existed at a point in time. Drop a file, get an immutable proof link.',
			image: 'https://saito.tech/wp-content/uploads/2023/11/saito-logo-300x300.png'
		};

		this.ui = null;
	}

	returnServices() {
		let services = [];
		if (this.app.BROWSER == 0) {
			services.push(new PeerService(null, 'witness'));
		}
		return services;
	}

	async initialize(app) {
		await super.initialize(app);

		if (app.BROWSER) {
			this.ui = new WitnessMain(app, this);
		}
	}

	async render() {
		if (!this.app.BROWSER || !this.browser_active) {
			return;
		}

		this.header = new SaitoHeader(this.app, this);
		await this.header.initialize(this.app);
		this.addComponent(this.header);

		await super.render();

		if (this.ui) {
			this.ui.render();
		}
	}

	//
	// ─── ON CONFIRMATION ─────────────────────────────────────
	//
	// Fires for every transaction tagged with module: "Witness"
	// conf 0 = first confirmation
	//
	async onConfirmation(blk, tx, conf) {
		if (conf !== 0) {
			return;
		}

		if (this.hasSeenTransaction(tx, Number(blk.id))) {
			return;
		}

		let txmsg = tx.returnMessage();

		if (txmsg.request !== 'witness timestamp') {
			return;
		}

		//
		// Server: store in database for indexed lookups
		//
		if (!this.app.BROWSER) {
			await this.receiveWitnessTransaction(tx, blk);
		}

		//
		// Browser: notify user if this is their own tx
		//
		if (this.app.BROWSER && tx.isFrom(this.publicKey)) {
			siteMessage('Your document has been witnessed on-chain!', 5000);
		}
	}

	//
	// ─── CREATE WITNESS TRANSACTION ──────────────────────────
	//
	// Called from the browser UI. Hashes are computed client-side;
	// only the hash, file name, and size are sent on-chain.
	//
	async createWitnessTransaction(fileHash, fileName, fileSize) {
		let newtx = await this.app.wallet.createUnsignedTransactionWithDefaultFee();
		newtx.msg = {
			module: 'Witness',
			request: 'witness timestamp',
			data: {
				hash: fileHash,
				fileName: fileName,
				fileSize: fileSize
			}
		};
		await newtx.sign();
		this.app.network.propagateTransaction(newtx);
		return newtx;
	}

	//
	// ─── RECEIVE WITNESS TRANSACTION (SERVER) ────────────────
	//
	// Stores the timestamp proof in the local SQLite database
	// for fast indexed lookups via the verification API.
	//
	async receiveWitnessTransaction(tx, blk) {
		let txmsg = tx.returnMessage();
		let data = txmsg.data || {};

		let fileHash = data.hash || '';
		let fileName = data.fileName || '';
		let fileSize = data.fileSize || 0;
		let txSig = tx.signature;
		let sender = tx.from[0]?.publicKey || '';
		let blockId = Number(blk.id) || 0;
		let blockHash = blk.hash || '';
		let createdAt = Date.now();

		let sql = `INSERT OR IGNORE INTO timestamps (file_hash, file_name, file_size, tx_sig, sender, block_id, block_hash, created_at)
		           VALUES ($file_hash, $file_name, $file_size, $tx_sig, $sender, $block_id, $block_hash, $created_at)`;

		let params = {
			$file_hash: fileHash,
			$file_name: fileName,
			$file_size: fileSize,
			$tx_sig: txSig,
			$sender: sender,
			$block_id: blockId,
			$block_hash: blockHash,
			$created_at: createdAt
		};

		let dbname = this.returnSlug();
		await this.app.storage.executeDatabase(sql, params, dbname);
	}

	//
	// ─── HANDLE PEER TRANSACTION ─────────────────────────────
	//
	// Responds to verification requests from browser clients:
	//   - "witness verify hash" : look up proofs by file hash
	//   - "witness verify sig"  : look up a proof by tx signature
	//
	async handlePeerTransaction(app, tx = null, peer, mycallback) {
		if (tx == null) {
			return 0;
		}

		let txmsg = tx.returnMessage();
		if (!txmsg?.request) {
			return 0;
		}

		if (txmsg.request === 'witness verify hash') {
			let fileHash = txmsg.data?.file_hash || '';
			if (!fileHash) {
				if (mycallback) { mycallback({ err: 'no hash provided', rows: [] }); }
				return 1;
			}

			let sql = `SELECT * FROM timestamps WHERE file_hash = $file_hash ORDER BY created_at DESC LIMIT 50`;
			let params = { $file_hash: fileHash };
			let dbname = this.returnSlug();

			try {
				let rows = await app.storage.queryDatabase(sql, params, dbname);
				if (mycallback) { mycallback({ err: '', rows: rows }); }
			} catch (err) {
				if (mycallback) { mycallback({ err: err.message, rows: [] }); }
			}

			return 1;
		}

		if (txmsg.request === 'witness verify sig') {
			let txSig = txmsg.data?.tx_sig || '';
			if (!txSig) {
				if (mycallback) { mycallback({ err: 'no signature provided', rows: [] }); }
				return 1;
			}

			let sql = `SELECT * FROM timestamps WHERE tx_sig = $tx_sig LIMIT 1`;
			let params = { $tx_sig: txSig };
			let dbname = this.returnSlug();

			try {
				let rows = await app.storage.queryDatabase(sql, params, dbname);
				if (mycallback) { mycallback({ err: '', rows: rows }); }
			} catch (err) {
				if (mycallback) { mycallback({ err: err.message, rows: [] }); }
			}

			return 1;
		}

		return super.handlePeerTransaction(app, tx, peer, mycallback);
	}

	//
	// ─── WEB SERVER ──────────────────────────────────────────
	//
	// Serves the module page and a REST API for programmatic verification.
	//
	webServer(app, expressapp, express) {
		let webdir = `${__dirname}/../../mods/${this.dirname}/web`;
		let witness_self = this;

		//
		// Main page
		//
		expressapp.get('/' + encodeURI(this.returnSlug()), async function (req, res) {
			let updatedSocial = Object.assign({}, witness_self.social);
			let html = WitnessHome(app, witness_self, app.build_number, updatedSocial);
			if (!res.finished) {
				res.setHeader('Content-type', 'text/html');
				res.charset = 'UTF-8';
				return res.send(html);
			}
			return;
		});

		//
		// Static assets (CSS, etc.)
		//
		expressapp.use('/' + encodeURI(this.returnSlug()), express.static(webdir));

		//
		// REST API: verify by transaction signature
		//
		expressapp.get('/' + encodeURI(this.returnSlug()) + '/api/verify/sig/:sig', async function (req, res) {
			let txSig = req.params.sig;
			if (!txSig) {
				return res.json({ err: 'no signature provided', rows: [] });
			}

			let sql = `SELECT * FROM timestamps WHERE tx_sig = $tx_sig LIMIT 1`;
			let params = { $tx_sig: txSig };
			let dbname = witness_self.returnSlug();

			try {
				let rows = await app.storage.queryDatabase(sql, params, dbname);
				return res.json({ err: '', rows: rows });
			} catch (err) {
				return res.json({ err: err.message, rows: [] });
			}
		});

		//
		// REST API: verify by file hash
		//
		expressapp.get('/' + encodeURI(this.returnSlug()) + '/api/verify/hash/:hash', async function (req, res) {
			let fileHash = req.params.hash;
			if (!fileHash) {
				return res.json({ err: 'no hash provided', rows: [] });
			}

			let sql = `SELECT * FROM timestamps WHERE file_hash = $file_hash ORDER BY created_at DESC LIMIT 50`;
			let params = { $file_hash: fileHash };
			let dbname = witness_self.returnSlug();

			try {
				let rows = await app.storage.queryDatabase(sql, params, dbname);
				return res.json({ err: '', rows: rows });
			} catch (err) {
				return res.json({ err: err.message, rows: [] });
			}
		});
	}
}

module.exports = Witness;

