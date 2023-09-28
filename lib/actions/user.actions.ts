"use server";

import { revalidatePath } from "next/cache";
import User from "../models/user.model";
import { connectToDB } from "../mongoose";
import Thread from "../models/thread.model";
import { FilterQuery, SortOrder } from "mongoose";

interface Params {
  userId: string;
  username: string;
  name: string;
  bio: string;
  image: string;
  path: string;
}

export async function updateUser({
  userId,
  username,
  name,
  bio,
  image,
  path,
}: Params): Promise<void> {
  connectToDB();

  try {
    await User.findOneAndUpdate(
      {
        id: userId,
      },
      {
        username: username.toLowerCase(),
        name,
        bio,
        image,
        path,
        onboarded: true,
      },
      { upsert: true }
    );

    if (path === "/profile/edit") {
      revalidatePath(path);
    }
  } catch (error: any) {
    throw new Error(`Failed to create/update user: ${error.message}`);
  }
}

export async function fetchUser(userId: string) {
  try {
    connectToDB();

    return await User.findOne({ id: userId });
    // .populate({
    // path: "communities",
    // model: Community,
    // });
  } catch (error: any) {
    throw new Error(`Failed to create/update user: ${error.message}`);
  }
}

export async function fecthUserPost(userId: string) {
  try {
    connectToDB();

    // Find all threads authord by the user with the given user id

    // TODO: Populate community
    const threads = await User.findOne({ id: userId }).populate({
      path: "threads",
      model: Thread,
      populate: {
        path: "children",
        model: Thread,
        populate: {
          path: "author",
          model: User,
          select: "name image id",
        },
      },
    });

    return threads;
  } catch (error: any) {
    throw new Error(`Failed to create/update user: ${error.message}`);
  }
}

export async function fectUsers({
  userId,
  searchString = "",
  pageNumber = 1,
  pageSize = 25,
  sortBy = "desc",
}: {
  userId: string;
  searchString?: string;
  pageNumber?: number;
  pageSize?: number;
  sortBy?: SortOrder;
}) {
  try {
    connectToDB();

    const skipamount = (pageNumber - 1) * pageSize;

    const regex = new RegExp(searchString, "i");

    const query: FilterQuery<typeof User> = {
      id: { $ne: userId },
    };

    if (searchString.trim() !== "") {
      query.$or = [
        { username: { $regex: regex } },
        { name: { $regex: regex } },
      ];
    }

    const sortOptions = { cretedAt: sortBy };

    const usersQuery = User.find(query)
      .sort(sortOptions)
      .skip(skipamount)
      .limit(pageSize);

    const totalUserCount = await User.countDocuments(query);

    const users = await usersQuery.exec();

    const isNext = totalUserCount > skipamount + userId.length;

    return { users, isNext };
  } catch (error: any) {
    throw new Error(`Failed to create/update user: ${error.message}`);
  }
}

export async function getActivity(userId: string) {
  try {
    connectToDB();

    // Find al threads created by the user
    const userThreads = await Thread.find({ author: userId });

    // Collect all the child thread ids (replies) from the children field
    const childThreadsIds = userThreads.reduce((acc, userThreads) => {
      return acc.concat(userThreads.children);
    }, []);

    const replies = await Thread.find({
      _id: { $in: childThreadsIds },
      author: { $ne: userId },
    }).populate({
      path: "author",
      model: User,
      select: "name image _id",
    });

    return replies;
  } catch (error: any) {
    throw new Error(`Failed to create/update user: ${error.message}`);
  }
}
