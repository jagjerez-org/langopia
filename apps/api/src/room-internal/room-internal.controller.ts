import {
  Controller,
  Post,
  Put,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from "@nestjs/swagger";
import { RoomInternalService } from "./room-internal.service.js";
import { JoinRoomDto } from "./dto/join-room.dto.js";
import { SendChatDto } from "./dto/send-chat.dto.js";
import { SaveNotesDto } from "./dto/save-notes.dto.js";
import { TranscribeChunkDto } from "./dto/transcribe-chunk.dto.js";

@ApiTags("Room")
@Controller("room")
export class RoomInternalController {
  constructor(private readonly roomService: RoomInternalService) {}

  @Post("join")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Join a room using teacher/student token" })
  @ApiResponse({ status: 200, description: "Successfully joined the room" })
  @ApiResponse({ status: 400, description: "Missing token or student fields" })
  @ApiResponse({ status: 404, description: "Invalid room token" })
  @ApiResponse({ status: 410, description: "Room/class is no longer active" })
  async joinRoom(@Body() dto: JoinRoomDto) {
    return this.roomService.joinRoom(dto);
  }

  @Post(":roomId/chat")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Save a chat message in a room" })
  @ApiResponse({ status: 201, description: "Chat message saved" })
  @ApiResponse({ status: 400, description: "Missing fields" })
  async sendChat(
    @Param("roomId") roomId: string,
    @Body() dto: SendChatDto,
  ) {
    return this.roomService.sendChat(roomId, dto);
  }

  @Put(":roomId/notes")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Save or update room notes" })
  @ApiResponse({ status: 200, description: "Notes saved" })
  async saveNotes(
    @Param("roomId") roomId: string,
    @Body() dto: SaveNotesDto,
  ) {
    return this.roomService.saveNotes(roomId, dto);
  }

  @Post(":roomId/recording")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Start recording a room session" })
  @ApiResponse({ status: 200, description: "Recording started" })
  @ApiResponse({ status: 400, description: "Recording already active or no LiveKit room" })
  @ApiResponse({ status: 404, description: "Room not found" })
  async startRecording(@Param("roomId") roomId: string) {
    return this.roomService.startRecording(roomId);
  }

  @Delete(":roomId/recording")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Stop recording a room session" })
  @ApiResponse({ status: 200, description: "Recording stopped" })
  @ApiResponse({ status: 400, description: "No active recording" })
  @ApiResponse({ status: 404, description: "Room not found" })
  async stopRecording(@Param("roomId") roomId: string) {
    return this.roomService.stopRecording(roomId);
  }

  @Post(":roomId/end")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "End a room session" })
  @ApiResponse({ status: 200, description: "Session ended" })
  @ApiResponse({ status: 400, description: "Room is already closed" })
  @ApiResponse({ status: 404, description: "Room not found" })
  async endSession(@Param("roomId") roomId: string) {
    return this.roomService.endSession(roomId);
  }

  @Post(":roomId/transcribe")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("audio"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Transcribe an audio chunk from a participant" })
  @ApiResponse({ status: 200, description: "Chunk transcribed" })
  @ApiResponse({ status: 400, description: "Rate limit or invalid data" })
  @ApiResponse({ status: 404, description: "Room not found" })
  async transcribeChunk(
    @Param("roomId") roomId: string,
    @UploadedFile() audio: Express.Multer.File,
    @Body() dto: TranscribeChunkDto,
  ) {
    return this.roomService.transcribeChunk(
      roomId,
      dto.participantId,
      dto.participantRole,
      audio,
    );
  }

  @Post(":roomId/suggestions")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Trigger content suggestions for end of class" })
  @ApiResponse({ status: 200, description: "Suggestions triggered" })
  @ApiResponse({ status: 404, description: "Room not found" })
  async triggerSuggestions(@Param("roomId") roomId: string) {
    return this.roomService.triggerSuggestions(roomId);
  }

  @Get(":roomId/suggestions")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Poll content suggestions status" })
  @ApiResponse({ status: 200, description: "Suggestions status" })
  @ApiResponse({ status: 404, description: "Room not found" })
  async getSuggestions(@Param("roomId") roomId: string) {
    return this.roomService.getSuggestions(roomId);
  }
}
