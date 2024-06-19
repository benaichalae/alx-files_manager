/* eslint-disable import/no-named-as-default */
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';

export default class AuthController {
  /**
   * Generates a new authentication token for the user and stores it in Redis.
   * @param {Request} req - The request object.
   * @param {Response} res - The response object.
   */
  static async login(req, res) {
    const { user } = req;
    const token = uuidv4();

    await redisClient.set(`auth_${token}`, user._id.toString(), 24 * 60 * 60);
    res.status(200).json({ token });
  }

  /**
   * Removes the authentication token from Redis, effectively logging the user out.
   * @param {Request} req - The request object.
   * @param {Response} res - The response object.
   */
  static async logout(req, res) {
    const token = req.headers['x-token'];

    await redisClient.del(`auth_${token}`);
    res.status(204).send();
  }
}
