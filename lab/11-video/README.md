# Dataviz Keynote & Archive Assets
## Hero Image

1. Create a representative hero image in PNG format. Refer to examples at [Visualize Data Archive](https://visualizedata.github.io/archive).
2. Name the file `preview.png` (lowercase).
3. Commit the file to the root directory of your thesis repository.

**Resolution:**  
1920px wide × 1080px high (HD).

---

## Demo Video: `demo.mp4`

### Preparation

- Use external earphones with a microphone, if available.
- Draft an initial script covering your demo talking points in 4 minutes or less.
- Use clear, conversational English.
- Scale your web content for optimal legibility before screen capture.

### Steps

1. Record audio.
2. Record HD video synchronized with the audio (HD 1080p, 1920px wide × 1080px high, H.264 codec).
3. Combine the audio and video, name the file `demo.mp4`, and save it.
4. Re-compress the video if necessary to stay under GitHub's 100MB file size limit.
5. Push the final file to the root directory of your repository.

---

### Tutorial

#### Record Audio

1. Open QuickTime Player.
2. Select `File > New Audio Recording`.
3. Press the record button and present your script, pausing after key points.
4. Press the stop button when finished.
5. Trim the recording (if needed) by selecting `Edit > Trim` in QuickTime.
6. Save the audio file as `demoAudio.m4a` (QuickTime uses the `.m4a` format).

#### Record Video

1. Open your project in the Chrome browser.
2. Toggle the Device Toolbar (`Control + Shift + M`) or select `View > Developer > Developer Tools` and click the Device Toolbar button.
3. Choose `Responsive` from the device list and set the dimensions to 1920px (width) × 1080px (height).
4. If using a Mac with a high-resolution display, select `50%` preview.
5. Open QuickTime Player and select `File > New Screen Recording`.
6. Press the record button.
7. Play the audio file recorded in Step 1 and demo your project in sync with the narration.
8. Press the stop button when finished.
9. Trim the video (if needed) by selecting `Edit > Trim` in QuickTime.
10. Save the video file as `demoVideo.mov`.

#### Combine Audio and Video

1. Drag the audio file (`demoAudio.m4a`) onto the video file (`demoVideo.mov`) in QuickTime.
2. Confirm the combination by pressing `Done`.
3. Save the combined file as `demo.mov`.

#### Compress to MP4

1. Open Adobe Media Encoder (available through The New School's free Adobe Creative Cloud subscription). Visit [The New School IT Knowledge Base](https://services.newschool.edu/TDClient/32/Portal/KB/ArticleDet?ID=49) for installation instructions.
2. Select `File > Add Source` and open `demo.mov`.
3. In the `Preset` settings, choose:
  - **Format:** `H.264`
  - **Preset:** `Match Source - Adaptive High Bitrate`
4. Ensure the final file size is under 50MB (check the `Estimated File Size` in the `Export Settings` window). If necessary, reduce the bitrate or manually adjust the frame rate to 30fps or 24fps.
5. Click the green `Start Queue` button and wait for encoding to complete.
6. Verify the output file (`demo.mp4`) by clicking the `Output File` path. Repeat the process if adjustments are needed.

**Alternative Tools:**  
- [VLC Media Player](https://www.videolan.org/vlc/) for encoding and compression.  
- [ScreenRec](https://screenrec.com/download-screenrec/) for screen and audio recording on PC.  
- Adobe Premiere for combining tracks.

---

## FAQ

### Why write a script first?
Crafting a script ensures your presentation is tailored to the audience, context, and time constraints (4 minutes). It helps you deliver a clear, concise, and engaging narrative.

### Why record audio before video?
Recording audio first allows you to focus on delivering your script effectively, with natural pacing and breaks. Once the narration is complete, you can use it as a guide to create a synchronized video presentation.

### Why compress the video?
GitHub imposes file size limits. Files larger than 50MB trigger warnings, and files exceeding 100MB are blocked. Compression ensures your video meets these requirements.

### Why commit assets to the repository?
Your GitHub repository serves as a central hub for all thesis-related assets. It provides a comprehensive resource for your audience and future visitors to explore your project.

### Do I need to submit the demo video to Drive?
Yes. The production team will embed your `demo.mp4` in the Keynote Google Slide deck. Ensure you meet submission deadlines to guarantee participation.
