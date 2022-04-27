import fp from 'fastify-plugin';
import mongoose from 'mongoose';
//import Spkey from '../models/spkey_mongoose';
//const models = { Spkey };

const dbConnector = async (fastify, options) => {
	try {
		mongoose.connection.on('connected', () => {
			fastify.log.info({ actor: 'MongoDB' }, 'connected');
		});
		mongoose.connection.on('disconnected', () => {
			fastify.log.error({ actor: 'MongoDB' }, 'disconnected');
		});
		const db = await mongoose.connect(options.url, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
			//useCreateIndex: true #not supported after v6
		});

		// decorates fastify with our model
		// fastify.decorate('db', { models });
                fastify.decorate('mongo', db);
	} catch (error) {
		fastify.log.error(error);
	}
};
export default fp(dbConnector);
