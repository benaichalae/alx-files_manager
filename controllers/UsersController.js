// No ESLint directives needed in this code snippet

import { promisify } from 'util';
import { Request, Response } from 'express';
import sha1 from 'sha1';
import Queue from 'bull/lib/queue';
import dbClient from '../utils/db';

const userQueue = new Queue('email sending');

const sha1Async = promisify(sha1);

export default class UsersController {
  /**
   * Creates a new user.
   * @param {Request} req The Express request object.
   * @param {Response} res The Express response object.
   */
  static async postNew(req, res) {
    const { email, password } = req.body || {};

    try {
      if (!email) throw new Error('Missing email');
      if (!password) throw new Error('Missing password');

      const usersCollection = await dbClient.usersCollection();
      const existingUser = await usersCollection.findOne({ email });

      if (existingUser) {
        throw new Error('User already exists');
      }

      const hashedPassword = await sha1Async(password);
      const insertionInfo = await usersCollection.insertOne({ email, password: hashedPassword });
      const userId = insertionInfo.insertedId.toString();

      userQueue.add({ userId });
      res.status(201).json({ email, id: userId });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Retrieves information about the authenticated user.
   * @param {Request} req The Express request object.
   * @param {Response} res The Express response object.
   */
  static async getMe(req, res) {
    const { user } = req;

    try {
      res.status(200).json({ email: user.email, id: user._id.toString() });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}
