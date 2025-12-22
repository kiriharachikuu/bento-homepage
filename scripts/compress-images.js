import fs from 'fs';
import path from 'path';
import imagemin from 'imagemin';
import imageminPngquant from 'imagemin-pngquant';
import imageminMozjpeg from 'imagemin-mozjpeg';
import imageminGifsicle from 'imagemin-gifsicle';
import imageminWebp from 'imagemin-webp';

// 源图片目录和目标目录
const srcDir = path.join(process.cwd(), 'public/img');
const destDir = path.join(process.cwd(), 'dist/img');

// 确保目标目录存在
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// 压缩图片的函数
async function compressImages() {
  try {
    console.log('开始压缩图片...');
    
    // 压缩主目录下的图片
    await imagemin([`${srcDir}/*.{png,jpg,jpeg,gif,webp}`], {
      destination: destDir,
      plugins: [
        imageminPngquant({
          quality: [0.7, 0.8],
          speed: 4
        }),
        imageminMozjpeg({
          quality: 80
        }),
        imageminGifsicle({
          optimizationLevel: 7,
          interlaced: false
        }),
        imageminWebp({
          quality: 80
        })
      ]
    });
    
    // 压缩视频缩略图目录下的图片
    const videoSrcDir = path.join(srcDir, 'video');
    const videoDestDir = path.join(destDir, 'video');
    
    if (fs.existsSync(videoSrcDir)) {
      if (!fs.existsSync(videoDestDir)) {
        fs.mkdirSync(videoDestDir, { recursive: true });
      }
      
      await imagemin([`${videoSrcDir}/*.{png,jpg,jpeg,gif,webp}`], {
        destination: videoDestDir,
        plugins: [
          imageminPngquant({
            quality: [0.7, 0.8],
            speed: 4
          }),
          imageminMozjpeg({
            quality: 80
          }),
          imageminGifsicle({
            optimizationLevel: 7,
            interlaced: false
          }),
          imageminWebp({
            quality: 80
          })
        ]
      });
    }
    
    console.log('图片压缩完成！');
  } catch (error) {
    console.error('压缩图片时出错：', error);
  }
}

// 执行压缩
compressImages();
