import sys
import time
import subprocess
import threading
from urllib.parse import urlparse
import signal
import atexit

should_exit = False


class YouTubeAudioPlayer:
    def __init__(self):
        self.mpv_process = None
        self.is_playing = False
        self.mpv_path = r"T:\TunaRP\MelodifyPlayer\ffmpeg\mpv\mpv.exe"

        self._setup_signal_handlers()

    def _setup_signal_handlers(self):

        def signal_handler(signum, frame):
            global should_exit
            should_exit = True
            print(f"\n[Python Player] Received signal {signum}")
            self.stop()

        signal.signal(signal.SIGTERM, signal_handler)
        signal.signal(signal.SIGINT, signal_handler)

        if hasattr(signal, 'SIGBREAK'):
            signal.signal(signal.SIGBREAK, signal_handler)

    def play(self, youtube_url, start_time=0):

        if self.is_playing:
            self.stop()

        if not self._is_valid_youtube_url(youtube_url):
            return False

        try:

            mpv_cmd = [
                self.mpv_path,
                "--no-video",
                "--quiet",
                "--ytdl=yes",
                "--ytdl-format=bestaudio",
            ]

            if start_time > 0:
                mpv_cmd.append(f"--start={start_time}")

            mpv_cmd.append(youtube_url)

            print("[Python Player] Running:", " ".join(mpv_cmd))

            self.mpv_process = subprocess.Popen(
                mpv_cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )

            self.is_playing = True

            monitor_thread = threading.Thread(target=self._monitor_playback)
            monitor_thread.daemon = True
            monitor_thread.start()

            return True

        except Exception:
            import traceback
            traceback.print_exc()
            return False

    def stop(self):

        self.is_playing = False

        try:
            if self.mpv_process:
                self.mpv_process.terminate()

                try:
                    self.mpv_process.wait(timeout=1)
                except subprocess.TimeoutExpired:
                    self.mpv_process.kill()

        except Exception:
            pass

        self.mpv_process = None
        print("[Python Player] Stopped")

    def _monitor_playback(self):

        if self.mpv_process:
            while self.mpv_process.poll() is None:
                time.sleep(0.1)

        self.is_playing = False
        self.mpv_process = None
        print("[Python Player] Playback ended naturally")

    def _is_valid_youtube_url(self, url):

        try:
            parsed = urlparse(url)

            valid_domains = [
                'youtube.com',
                'www.youtube.com',
                'youtu.be',
                'm.youtube.com'
            ]

            return parsed.netloc in valid_domains

        except Exception:
            return False


def main():

    global should_exit

    if len(sys.argv) < 2:
        print("Usage: python youtubePlayer.py <youtube_url> [--start-time]")
        sys.exit(1)

    youtube_url = sys.argv[1]

    start_time = 0

    if '--start-time' in sys.argv:
        idx = sys.argv.index('--start-time')
        if idx + 1 < len(sys.argv):
            start_time = float(sys.argv[idx + 1])

    player = YouTubeAudioPlayer()

    def cleanup():
        if player.is_playing:
            player.stop()

    atexit.register(cleanup)

    success = player.play(youtube_url, start_time)

    if not success:
        sys.exit(1)

    try:
        while player.is_playing and not should_exit:
            time.sleep(0.5)

    except KeyboardInterrupt:
        player.stop()

    finally:
        if player.is_playing:
            player.stop()


if __name__ == "__main__":
    main()