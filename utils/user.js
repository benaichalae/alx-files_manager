import { ObjectId } from 'mongodb';
import redisClient from './redis';
import dbClient from './db';

/**
 * Module with user utilities
 */
const userUtils = {
  /**
   * Gets a user id and key of redis from request
   * @param {object} request Express request object
   * @returns {Promise<{ userId: string|null, key: string|null }>}
   */
  async getUserIdAndKey(request) {
    const obj = { userId: null, key: null };

    const xToken = request.headers['x-token'];

    if (!xToken) return obj;

    obj.key = `auth_${xToken}`;

    obj.userId = await redisClient.get(obj.key);

    return obj;
  },

  /**
   * Gets a user from database
   * @param {object} query Query expression for finding user
   * @returns {Promise<object|null>} User document object or null if not found
   */
  async getUser(query) {
    const user = await dbClient.usersCollection.findOne(query);
    return user;
  },
};

export default userUtils;
