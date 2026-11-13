const cloudinary = require("cloudinary").v2;

exports.deleteUploadedMaterials = async (materials) => {
  await Promise.all(
    materials
      .filter((material) => material?.publicId)
      .map(async (material) => {
        try {
          await cloudinary.uploader.destroy(material.publicId, {
            resource_type: material.resourceType || "image",
          });
        } catch (error) {
          console.error("Could not clean up course material upload:", error);
        }
      }),
  );
};
