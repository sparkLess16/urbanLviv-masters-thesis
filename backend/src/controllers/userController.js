import bcrypt from "bcrypt";
import cloudinary from "../config/cloudinary.js";

const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "urbanlviv/avatars" },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );

    stream.end(fileBuffer);
  });
};
export const updateCurrentUser = async (req, res) => {
  try {
    const user = req.user;
    const { name, email, password, removeAvatar } = req.body;
    if (name) user.name = name;
    if (email) user.email = email;
    if (password && password.trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    if (removeAvatar === "true") {
      user.avatar_url = "";
    }

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      user.avatar_url = result.secure_url;
    }
    const updatedUser = await user.save();

    res.json({
      id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      avatar_url: updatedUser.avatar_url,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
