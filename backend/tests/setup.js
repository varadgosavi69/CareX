// Test harness: spin up an isolated in-memory MongoDB for each test file,
// connect Mongoose to it, wipe all collections between tests so they stay
// independent, and tear everything down afterwards.

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongo;

// Generous timeout: the very first run may still be extracting the mongod
// binary. Once cached/extracted, startup is a couple of seconds.
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}, 120000);

afterEach(async () => {
  // Clear every collection so each test starts from a clean slate.
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongo) await mongo.stop();
});
