import { Injectable } from "@nestjs/common";
import { RoomProvider } from "../../domain/model/room-provider.js";
import type {
  ExternalTranscriptImporterPort,
  ImportExternalTranscriptRequest,
  ImportExternalTranscriptResult,
} from "../../domain/ports/external-transcript-importer.port.js";
import { MeetTranscriptAdapter } from "./meet-transcript.adapter.js";
import { TeamsTranscriptAdapter } from "./teams-transcript.adapter.js";
import { ZoomTranscriptAdapter } from "./zoom-transcript.adapter.js";

@Injectable()
export class ExternalTranscriptImporterRegistry implements ExternalTranscriptImporterPort {
  constructor(
    private readonly zoom: ZoomTranscriptAdapter,
    private readonly meet: MeetTranscriptAdapter,
    private readonly teams: TeamsTranscriptAdapter,
  ) {}

  importTranscript(request: ImportExternalTranscriptRequest): Promise<ImportExternalTranscriptResult> {
    switch (request.provider) {
      case RoomProvider.Zoom:
        return this.zoom.importTranscript(request);
      case RoomProvider.GoogleMeet:
        return this.meet.importTranscript(request);
      case RoomProvider.MsTeams:
        return this.teams.importTranscript(request);
    }
  }
}
