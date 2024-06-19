import { ObjectID } from 'mongodb';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import Queue from 'bull';
import { findUserIdByToken } from '../utils/helpers';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export default class FilesController {
  /**
   * Endpoint: POST /files/upload
   * Description: Create a new file in DB and on disk.
   * Response:
   *   - Status Code: 201
   *   - Body: { id, userId, name, type, isPublic, parentId }
   *   - Status Code: 400
   *   - Body: { error: 'Unauthorized' } or { error: 'Missing name' } or { error: 'Missing type' } or { error: 'Parent not found' } or { error: 'Parent is not a folder' } or { error: 'Missing data' }
   */
  static postUpload = async (request, response) => {
    try {
      const fileQueue = new Queue('fileQueue');

      // Retrieve the user ID based on the token
      const userId = await findUserIdByToken(request);
      if (!userId) return response.status(401).json({ error: 'Unauthorized' });

      // Validate request data
      const { name, type, data, isPublic = false, parentId = 0 } = request.body;
      if (!name) return response.status(400).json({ error: 'Missing name' });
      if (!type || !['folder', 'file', 'image'].includes(type)) return response.status(400).json({ error: 'Missing type' });

      // Validate parent ID if provided
      if (parentId !== 0) {
        const parentFile = await dbClient.files.findOne({ _id: ObjectID(parentId) });
        if (!parentFile) return response.status(400).json({ error: 'Parent not found' });
        if (parentFile.type !== 'folder') return response.status(400).json({ error: 'Parent is not a folder' });
      }

      // Handle folder creation
      if (type === 'folder') {
        const fileInserted = await dbClient.files.insertOne({
          userId: ObjectID(userId),
          name,
          type,
          isPublic,
          parentId: parentId === 0 ? parentId : ObjectID(parentId),
        });
        return response.status(201).json({
          id: fileInserted.ops[0]._id, userId, name, type, isPublic, parentId,
        });
      }

      // Handle file creation
      if (!data) return response.status(400).json({ error: 'Missing data' });

      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

      const filenameUUID = uuidv4();
      const localPath = `${folderPath}/${filenameUUID}`;

      const clearData = Buffer.from(data, 'base64');
      await fs.promises.writeFile(localPath, clearData, { flag: 'w+' });

      const fileInserted = await dbClient.files.insertOne({
        userId: ObjectID(userId),
        name,
        type,
        isPublic,
        parentId: parentId === 0 ? parentId : ObjectID(parentId),
        localPath,
      });

      if (type === 'image') {
        await fs.promises.writeFile(localPath, clearData, { flag: 'w+', encoding: 'binary' });
        await fileQueue.add({ userId, fileId: fileInserted.insertedId, localPath });
      }

      return response.status(201).json({
        id: fileInserted.ops[0]._id, userId, name, type, isPublic, parentId,
      });
    } catch (error) {
      console.error('Error during file upload:', error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  };

  /**
   * Endpoint: GET /files/:id
   * Description: Retrieve file details by file ID.
   * Response:
   *   - Status Code: 200
   *   - Body: { id, userId, name, type, isPublic, parentId }
   *   - Status Code: 401
   *   - Body: { error: 'Unauthorized' } or { error: 'Not found' }
   */
  static getShow = async (request, response) => {
    try {
      const token = request.headers['x-token'];
      if (!token) return response.status(401).json({ error: 'Unauthorized' });

      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) return response.status(401).json({ error: 'Unauthorized' });

      const user = await dbClient.users.findOne({ _id: ObjectID(userId) });
      if (!user) return response.status(401).json({ error: 'Unauthorized' });

      const fileId = request.params.id;
      const file = await dbClient.files.findOne({ _id: ObjectID(fileId), userId: ObjectID(userId) });
      if (!file) return response.status(404).json({ error: 'Not found' });

      return response.json({
        id: file._id,
        userId: file.userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId,
      });
    } catch (error) {
      console.error('Error during file retrieval:', error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  };

  /**
   * Endpoint: GET /files
   * Description: Retrieve files attached to the user with optional pagination.
   * Response:
   *   - Status Code: 200
   *   - Body: Array of { id, userId, name, type, isPublic, parentId }
   *   - Status Code: 401
   *   - Body: { error: 'Unauthorized' }
   */
  static getIndex = async (request, response) => {
    try {
      const token = request.headers['x-token'];
      if (!token) return response.status(401).json({ error: 'Unauthorized' });

      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) return response.status(401).json({ error: 'Unauthorized' });

      const parentId = request.query.parentId || '0';
      const pagination = parseInt(request.query.page, 10) || 0;

      const user = await dbClient.users.findOne({ _id: ObjectID(userId) });
      if (!user) return response.status(401).json({ error: 'Unauthorized' });

      let aggregatePipeline = [];
      if (parentId !== '0') {
        aggregatePipeline = [
          { $match: { parentId: ObjectID(parentId) } },
          { $skip: pagination * 20 },
          { $limit: 20 },
        ];
      } else {
        aggregatePipeline = [
          { $skip: pagination * 20 },
          { $limit: 20 },
        ];
      }

      const files = await dbClient.files.aggregate(aggregatePipeline).toArray();
      const formattedFiles = files.map((file) => ({
        id: file._id,
        userId: file.userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId,
      }));

      return response.json(formattedFiles);
    } catch (error) {
      console.error('Error during file listing:', error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  };
}
