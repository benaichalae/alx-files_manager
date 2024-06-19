// No ESLint directives needed in this code snippet

import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { mkdir, writeFile, stat, existsSync, realpath } from 'fs';
import { join as joinPath } from 'path';
import { Request, Response } from 'express';
import { contentType } from 'mime-types';
import mongoDBCore from 'mongodb/lib/core';
import dbClient from '../utils/db';
import { getUserFromXToken } from '../utils/auth';
import Queue from 'bull/lib/queue';

const VALID_FILE_TYPES = {
  folder: 'folder',
  file: 'file',
  image: 'image',
};
const ROOT_FOLDER_ID = 0;
const DEFAULT_ROOT_FOLDER = 'files_manager';
const mkDirAsync = promisify(mkdir);
const writeFileAsync = promisify(writeFile);
const statAsync = promisify(stat);
const realpathAsync = promisify(realpath);
const MAX_FILES_PER_PAGE = 20;
const fileQueue = new Queue('thumbnail generation');
const NULL_ID = Buffer.alloc(24, '0').toString('utf-8');
const isValidId = (id) => {
  const size = 24;
  const charRanges = [
    [48, 57], // 0 - 9
    [97, 102], // a - f
    [65, 70], // A - F
  ];
  if (typeof id !== 'string' || id.length !== size) {
    return false;
  }
  for (let i = 0; i < size; i++) {
    const c = id[i];
    const code = c.charCodeAt(0);
    if (!charRanges.some((range) => code >= range[0] && code <= range[1])) {
      return false;
    }
  }
  return true;
};

export default class FilesController {
  /**
   * Uploads a file.
   * @param {Request} req The Express request object.
   * @param {Response} res The Express response object.
   */
  static async postUpload(req, res) {
    const { user } = req;
    const { name, type, parentId, isPublic, data } = req.body || {};
    const base64Data = data || '';

    try {
      if (!name) throw new Error('Missing name');
      if (!type || !Object.values(VALID_FILE_TYPES).includes(type)) throw new Error('Missing or invalid type');
      if (!data && type !== VALID_FILE_TYPES.folder) throw new Error('Missing data');
      
      const parentFile = parentId !== ROOT_FOLDER_ID && parentId !== ROOT_FOLDER_ID.toString()
        ? await dbClient.filesCollection().findOne({
            _id: new mongoDBCore.BSON.ObjectId(isValidId(parentId) ? parentId : NULL_ID),
          })
        : null;

      if (parentId !== ROOT_FOLDER_ID && parentId !== ROOT_FOLDER_ID.toString() && (!parentFile || parentFile.type !== VALID_FILE_TYPES.folder)) {
        throw new Error('Parent not found or is not a folder');
      }

      const userId = user._id.toString();
      const baseDir = (process.env.FOLDER_PATH || '').trim().length > 0
        ? process.env.FOLDER_PATH.trim()
        : joinPath(tmpdir(), DEFAULT_ROOT_FOLDER);
      const newFile = {
        userId: new mongoDBCore.BSON.ObjectId(userId),
        name,
        type,
        isPublic: Boolean(isPublic),
        parentId: parentId === ROOT_FOLDER_ID || parentId === ROOT_FOLDER_ID.toString()
          ? '0'
          : new mongoDBCore.BSON.ObjectId(parentId),
      };

      await mkDirAsync(baseDir, { recursive: true });
      
      if (type !== VALID_FILE_TYPES.folder) {
        const localPath = joinPath(baseDir, uuidv4());
        await writeFileAsync(localPath, Buffer.from(base64Data, 'base64'));
        newFile.localPath = localPath;
      }

      const insertionInfo = await dbClient.filesCollection().insertOne(newFile);
      const fileId = insertionInfo.insertedId.toString();

      if (type === VALID_FILE_TYPES.image) {
        const jobName = `Image thumbnail [${userId}-${fileId}]`;
        fileQueue.add({ userId, fileId, name: jobName });
      }

      res.status(201).json({
        id: fileId,
        userId,
        name,
        type,
        isPublic,
        parentId: parentId === ROOT_FOLDER_ID || parentId === ROOT_FOLDER_ID.toString()
          ? 0
          : parentId,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Retrieves a file by ID.
   * @param {Request} req The Express request object.
   * @param {Response} res The Express response object.
   */
  static async getShow(req, res) {
    const { user } = req;
    const id = req.params.id || NULL_ID;
    const userId = user._id.toString();

    try {
      const file = await dbClient.filesCollection().findOne({
        _id: new mongoDBCore.BSON.ObjectId(isValidId(id) ? id : NULL_ID),
        userId: new mongoDBCore.BSON.ObjectId(isValidId(userId) ? userId : NULL_ID),
      });

      if (!file) throw new Error('File not found');

      res.status(200).json({
        id,
        userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId === ROOT_FOLDER_ID.toString()
          ? 0
          : file.parentId.toString(),
      });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  /**
   * Retrieves files associated with a specific user.
   * @param {Request} req The Express request object.
   * @param {Response} res The Express response object.
   */
  static async getIndex(req, res) {
    const { user } = req;
    const parentId = req.query.parentId || ROOT_FOLDER_ID.toString();
    const page = /\d+/.test(req.query.page.toString()) ? parseInt(req.query.page, 10) : 0;

    try {
      const filesFilter = {
        userId: user._id,
        parentId: parentId === ROOT_FOLDER_ID.toString()
          ? parentId
          : new mongoDBCore.BSON.ObjectId(isValidId(parentId) ? parentId : NULL_ID),
      };

      const files = await dbClient.filesCollection()
        .aggregate([
          { $match: filesFilter },
          { $sort: { _id: -1 } },
          { $skip: page * MAX_FILES_PER_PAGE },
          { $limit: MAX_FILES_PER_PAGE },
          {
            $project: {
              _id: 0,
              id: '$_id',
              userId: '$userId',
              name: '$name',
              type: '$type',
              isPublic: '$isPublic',
              parentId: {
                $cond: { if: { $eq: ['$parentId', '0'] }, then: 0, else: '$parentId' },
              },
            },
          },
        ]).toArray();

      res.status(200).json(files);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Updates a file to be public.
   * @param {Request} req The Express request object.
   * @param {Response} res The Express response object.
   */
  static async putPublish(req, res) {
    const { user } = req;
    const { id } = req.params;

    try {
      const userId = user._id.toString();
      const fileFilter = {
        _id: new mongoDBCore.BSON.ObjectId(isValidId(id) ? id : NULL_ID),
        userId: new mongoDBCore.BSON.ObjectId(isValidId(userId) ? userId : NULL_ID),
      };

      const file = await dbClient.filesCollection().findOne(fileFilter);

      if (!file) throw new Error('File not found');

      await dbClient.filesCollection().updateOne(fileFilter, { $set: { isPublic: true } });

      res.status(200).json({
        id,
        userId,
        name: file.name,
        type: file.type,
        isPublic: true,
        parentId: file.parentId === ROOT_FOLDER_ID.toString()
          ? 0
          : file.parentId.toString(),
      });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  /**
   * Updates a file to be private.
   * @param {Request} req The Express request object.
   * @param {Response} res The Express response object.
   */
  static async putUnpublish(req, res) {
    const { user } = req;
    const { id } = req.params;

    try {
      const userId = user._id.toString();
      const fileFilter = {
        _id: new mongoDBCore.BSON.ObjectId(isValidId(id) ? id : NULL_ID),
        userId: new mongoDBCore.BSON.ObjectId(isValidId(userId) ? userId : NULL_ID),
      };

      const file = await dbClient.filesCollection().findOne(fileFilter);

      if (!file) throw new Error('File not found');

      await dbClient.filesCollection().updateOne(fileFilter, { $set: { isPublic: false } });

      res.status(200).json({
        id,
        userId,
        name: file.name,
        type: file.type,
        isPublic: false,
        parentId: file.parentId === ROOT_FOLDER_ID.toString()
          ? 0
          : file.parentId.toString(),
      });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  /**
   * Retrieves the content of a file.
   * @param {Request} req The Express request object.
   * @param {Response} res The Express response object.
   */
  static async getFile(req, res) {
    const user = await getUserFromXToken(req);
    const { id } = req.params;
    const size = req.query.size || null;
    const userId = user ? user._id.toString() : '';

    try {
      const fileFilter = {
        _id: new mongoDBCore.BSON.ObjectId(isValidId(id) ? id : NULL_ID),
      };

      const file = await dbClient.filesCollection().findOne(fileFilter);

      if (!file || (!file.isPublic && file.userId.toString() !== userId)) {
        throw new Error('File not found or unauthorized access');
      }

      if (file.type === VALID_FILE_TYPES.folder) {
        throw new Error('A folder does not have content');
      }

      let filePath = file.localPath;

      if (size) {
        filePath = `${file.localPath}_${size}`;
      }

      if (!existsSync(filePath)) {
        throw new Error('File not found');
      }

      const fileInfo = await statAsync(filePath);

      if (!fileInfo.isFile()) {
        throw new Error('Not a valid file');
      }

      const absoluteFilePath = await realpathAsync(filePath);
      res.setHeader('Content-Type', contentType(file.name) || 'text/plain; charset=utf-8');
      res.status(200).sendFile(absoluteFilePath);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }
}
