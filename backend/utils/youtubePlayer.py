import os
import sys
import time
import subprocess
import threading
from urllib.parse import urlparse
import tempfile
import signal
import atexit

should_exit = False


class YouTubeAudioPlayer:
    
    def __init__(self):
        self.current_process = None
        self.is_playing = False
        self.temp_dir = tempfile.gettempdir()
        self.temp_file_path = None
        self.ffmpeg_path = r'T:\TunaRP\MelodifyPlayer\ffmpeg\bin'
        self._setup_signal_handlers()
    
    def _setup_signal_handlers(self):
        def signal_handler(signum, frame):
            global should_exit
            should_exit = True
            print(f"\n[Python Player] Received signal {signum}, stopping...")
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
            temp_path = os.path.join(self.temp_dir, f'temp_audio_{int(time.time())}.m4a')

            
            download_command = [
                'yt-dlp',
                '--format', 'bestaudio[ext=m4a]/bestaudio',
                '--no-playlist',
                '--ffmpeg-location', self.ffmpeg_path,
                '-o', temp_path,
                youtube_url
            ]
            
            download_process = subprocess.Popen(
                download_command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            stdout, stderr = download_process.communicate()
            
            print(f"Download stdout: {stdout}")
            if stderr:
                print(f"Download stderr: {stderr}")

            if download_process.returncode != 0:
                error_msg = stderr if stderr else "Unknown error"
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                return False
            
            if not os.path.exists(temp_path) or os.path.getsize(temp_path) == 0:
                print("Error: Downloaded file is empty or doesn't exist")
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                return False
            
            print(f"Downloaded {os.path.getsize(temp_path)} bytes")
            self.temp_file_path = temp_path
            
            ffplay_command = [
                os.path.join(self.ffmpeg_path, 'ffplay.exe' if os.name == 'nt' else 'ffplay'),
            ]
            
            if start_time > 0:
                ffplay_command.extend(['-ss', str(start_time)])
            
            ffplay_command.extend([
                '-nodisp',
                '-autoexit',
                '-loglevel', 'error',
                temp_path
            ])
            
            self.current_process = subprocess.Popen(
                ffplay_command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            time.sleep(0.5)
            
            if self.current_process.poll() is not None:
                stderr_output = self.current_process.stderr.read().decode('utf-8', errors='ignore')
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                    self.temp_file_path = None
                self.current_process = None
                return False
            
            self.is_playing = True
            
            monitor_thread = threading.Thread(target=self._monitor_playback)
            monitor_thread.daemon = True
            monitor_thread.start()
            return True
            
        except FileNotFoundError:
            return False
        except Exception as e:
            import traceback
            traceback.print_exc()
            return False
    
    def play_with_vlc(self, youtube_url):
        if self.is_playing:
            self.stop()
        
        if not self._is_valid_youtube_url(youtube_url):
            return False
        
        try:
            command = [
                'vlc',
                '--no-video',
                '--intf', 'dummy',
                '--play-and-exit',
                youtube_url
            ]
            
            self.current_process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            self.is_playing = True
            
            monitor_thread = threading.Thread(target=self._monitor_playback)
            monitor_thread.daemon = True
            monitor_thread.start()
            
            return True
            
        except FileNotFoundError:
            print("Error: VLC not found. Please install VLC media player.")
            return False
        except Exception as e:
            return False
    
    def stop(self):
        if self.current_process and self.is_playing:
            try:
                self.current_process.terminate()
                try:
                    self.current_process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    self.current_process.kill()
                    self.current_process.wait()
            except Exception as e:
                print(f"Error stopping playback: {e}")
            
            if self.temp_file_path and os.path.exists(self.temp_file_path):
                try:
                    os.unlink(self.temp_file_path)
                except Exception as e:
                    print(f"Error cleaning up temp file: {e}")
            
            self.current_process = None
            self.temp_file_path = None
            self.is_playing = False
            print("[Python Player] Process killed with signal: SIGTERM")

    def _monitor_playback(self):
        if self.current_process:
            self.current_process.wait()
            
            if self.temp_file_path and os.path.exists(self.temp_file_path):
                try:
                    os.unlink(self.temp_file_path)
                except Exception as e:
                    print(f"Error cleaning up temp file: {e}")
            
            self.is_playing = False
            self.current_process = None
            self.temp_file_path = None

    def _is_valid_youtube_url(self, url):
        try:
            parsed = urlparse(url)
            valid_domains = ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com']
            return parsed.netloc in valid_domains
        except Exception:
            return False
    
    def get_status(self):
        return {
            'is_playing': self.is_playing,
            'has_process': self.current_process is not None
        }


def main():
    global should_exit
    if len(sys.argv) < 2:
        print("Usage: python youtubePlayer.py <youtube_url> [--vlc] [--start-time SECONDS]")
        print("\nOptions:")
        print("  --vlc           Use VLC media player instead of ffplay")
        print("  --start-time    Start playback from specified time in seconds")
        sys.exit(1)
    
    youtube_url = sys.argv[1]
    use_vlc = '--vlc' in sys.argv
    start_time = 0
    
    if '--start-time' in sys.argv:
        idx = sys.argv.index('--start-time')
        if idx + 1 < len(sys.argv):
            try:
                start_time = float(sys.argv[idx + 1])
            except ValueError:
                print("Error: start-time must be a number")
                sys.exit(1)
    
    player = YouTubeAudioPlayer()
    
    def cleanup():
        if player.is_playing:
            player.stop()
    atexit.register(cleanup)
    
    if use_vlc:
        success = player.play_with_vlc(youtube_url)
    else:
        success = player.play(youtube_url, start_time)
    
    if not success:
        sys.exit(1)
    
    try:
        while player.is_playing and not should_exit:
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nStopping playback...")
        player.stop()
    finally:
        if player.is_playing:
            player.stop()


if __name__ == "__main__":
    main()
