# homebridge-irkit-ext

Supports IRKit on HomeBridge Platform.  
Homebridgeを通してIRKitを操作できるようにするプラグイン。Fork元からの変更点は以下。
- ホームAppのシーン切り替え等により連続してIRKitに信号が送信されるとうまく信号が発出されないのを修正
  - 信号の長さに応じて一定時間送信間隔を開けるようにした
- 照明タイプに対応
  - アイコンが変わるだけ
- エアコンタイプに対応
  - AppleやGoogleのホームAppからエアコンパネルが利用可能
  - 温度表示（homebridge内のファイル読み取り）に対応
  - 暖房、冷房、自動、オフ操作に対応
  - ターゲット温度の変更は非対応、固定値を表示

IRKit HomePage
http://getirkit.com/  

# Installation
1. Install homebridge using: sudo npm install -g homebridge
2. Install this plugin using: sudo npm install -g homebridge-irkit-mod
3. Update your configuration file. See sample-config.json in this repository for a sample. 

# Configuration

Configuration sample:

 ```
"accessories": [
        {
            "accessory": "IRKitMod",
            "name": "Switch device",
            "irkit_host": "irkitxxxxx.local",
            "on_form": {"format":"raw","freq":38,"data":[]},
            "off_form": {"format":"raw","freq":38,"data":[]}
        },
        {
            "accessory": "IRKitMod",
            "name": "Light device",
            "irkit_host": "irkitxxxxx.local",
            "type": "light",
            "on_form": {"format":"raw","freq":38,"data":[]},
            "off_form": {"format":"raw","freq":38,"data":[]}
        },
        {
            "accessory": "IRKitMod",
            "name": "Aircon device",
            "irkit_host": "irkitxxxxx.local",
            "type": "aircon",
            "heat_target": 22,
            "cool_tareget": 27,
            "temperature_file": "/dev/shm/room_temp.txt",
            "heater_form": {"format":"raw","freq":38,"data":[]},
            "cooler_form": {"format":"raw","freq":38,"data":[]},
            "auto_form": {"format":"raw","freq":38,"data":[]},
            "off_form": {"format":"raw","freq":38,"data":[]}
        },
    ]

```
