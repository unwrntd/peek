import { BaseIntegration } from './base';
import { ProxmoxIntegration } from './proxmox';
import { UnifiIntegration } from './unifi';
import { UnifiProtectIntegration } from './unifi-protect';
import { BeszelIntegration } from './beszel';
import { AdGuardIntegration } from './adguard';
import { QnapIntegration } from './qnap';
import { PlexIntegration } from './plex';
import { CiscoIOSXEIntegration } from './cisco-iosxe';
import { PiKVMIntegration } from './pikvm';
import { GLKVMIntegration } from './glkvm';
import { TautulliIntegration } from './tautulli';
import { TapoIntegration } from './tapo';
import { KasaIntegration } from './kasa';
import { OverseerrIntegration } from './overseerr';
import { HomeConnectIntegration } from './homeconnect';
import { SonarrIntegration } from './sonarr';
import { RadarrIntegration } from './radarr';
import { TdarrIntegration } from './tdarr';
import { BazarrIntegration } from './bazarr';
import { ProwlarrIntegration } from './prowlarr';
import { SABnzbdIntegration } from './sabnzbd';
import { QBittorrentIntegration } from './qbittorrent';
import { RingIntegration } from './ring';
import { ImmichIntegration } from './immich';
import { WeatherIntegration } from './weather';
import { HomebridgeIntegration } from './homebridge';
import { HomeAssistantIntegration } from './homeassistant';
import { NetAlertXIntegration } from './netalertx';
import { ActualBudgetIntegration } from './actualbudget';
import { NodeRedIntegration } from './nodered';
import { OllamaIntegration } from './ollama';
import { KasmIntegration } from './kasm';
import { WazuhIntegration } from './wazuh';
import { PaperlessIntegration } from './paperless';
import { SonosIntegration } from './sonos';
import { MikroTikIntegration } from './mikrotik';
import { ControlDIntegration } from './controld';
import { NotionIntegration } from './notion';
import { SlackIntegration } from './slack';
import { OnePasswordIntegration } from './onepassword';
import { DiscordIntegration } from './discord';
import { GESmartHQIntegration } from './ge-smarthq';
import { LGThinQIntegration } from './lg-thinq';
import { PlantitIntegration } from './plantit';
import { HomeKitIntegration } from './homekit';
import { Microsoft365Integration } from './microsoft365';
import { GoogleWorkspaceIntegration } from './google-workspace';
import { StorjIntegration } from './storj';
import { KitchenOwlIntegration } from './kitchenowl';
import { ESXiIntegration } from './esxi';
import { PANOSIntegration } from './panos';
import { FortiGateIntegration } from './fortigate';
import { GitHubIntegration } from './github';
import { GiteaIntegration } from './gitea';
import { DockerIntegration } from './docker';
import { TailscaleIntegration } from './tailscale';
import { OPNsenseIntegration } from './opnsense';
// import { EcobeeIntegration } from './ecobee'; // Disabled: Ecobee closed developer program

class IntegrationRegistry {
  private integrations: Map<string, BaseIntegration> = new Map();

  constructor() {
    this.register(new ProxmoxIntegration());
    this.register(new SlackIntegration());
    this.register(new UnifiIntegration());
    this.register(new UnifiProtectIntegration());
    this.register(new BeszelIntegration());
    this.register(new AdGuardIntegration());
    this.register(new QnapIntegration());
    this.register(new PlexIntegration());
    this.register(new CiscoIOSXEIntegration());
    this.register(new PiKVMIntegration());
    this.register(new GLKVMIntegration());
    this.register(new TautulliIntegration());
    this.register(new TapoIntegration());
    this.register(new KasaIntegration());
    this.register(new OverseerrIntegration());
    this.register(new HomeConnectIntegration());
    this.register(new SonarrIntegration());
    this.register(new RadarrIntegration());
    this.register(new TdarrIntegration());
    this.register(new BazarrIntegration());
    this.register(new ProwlarrIntegration());
    this.register(new SABnzbdIntegration());
    this.register(new QBittorrentIntegration());
    this.register(new RingIntegration());
    this.register(new ImmichIntegration());
    this.register(new WeatherIntegration());
    this.register(new HomebridgeIntegration());
    this.register(new HomeAssistantIntegration());
    this.register(new NetAlertXIntegration());
    this.register(new ActualBudgetIntegration());
    this.register(new NodeRedIntegration());
    this.register(new OllamaIntegration());
    this.register(new KasmIntegration());
    this.register(new WazuhIntegration());
    this.register(new PaperlessIntegration());
    this.register(new SonosIntegration());
    this.register(new MikroTikIntegration());
    this.register(new ControlDIntegration());
    this.register(new NotionIntegration());
    this.register(new OnePasswordIntegration());
    this.register(new DiscordIntegration());
    this.register(new GESmartHQIntegration());
    this.register(new LGThinQIntegration());
    this.register(new PlantitIntegration());
    this.register(new HomeKitIntegration());
    this.register(new Microsoft365Integration());
    this.register(new GoogleWorkspaceIntegration());
    this.register(new StorjIntegration());
    this.register(new KitchenOwlIntegration());
    this.register(new ESXiIntegration());
    this.register(new PANOSIntegration());
    this.register(new FortiGateIntegration());
    this.register(new GitHubIntegration());
    this.register(new GiteaIntegration());
    this.register(new DockerIntegration());
    this.register(new TailscaleIntegration());
    this.register(new OPNsenseIntegration());
    // this.register(new EcobeeIntegration()); // Disabled: Ecobee closed developer program
  }

  register(integration: BaseIntegration): void {
    this.integrations.set(integration.type, integration);
  }

  get(type: string): BaseIntegration | undefined {
    return this.integrations.get(type);
  }

  getAll(): BaseIntegration[] {
    return Array.from(this.integrations.values());
  }

  getTypes(): { type: string; name: string }[] {
    return this.getAll().map(i => ({ type: i.type, name: i.name }));
  }
}

export const integrationRegistry = new IntegrationRegistry();
