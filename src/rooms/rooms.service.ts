import { UsersService } from 'src/users/users.service';
import { Room, RoomDocument } from './entities/room.entity';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotAcceptableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Model } from 'mongoose';
import { AddMemberByIdDto } from './dto/add-member.dto';
import { UserDocument } from 'src/users/entities/user.entity';

@Injectable()
export class RoomsService {
  private readonly name = 'Room Service';

  constructor(
    @InjectModel(Room.name) private readonly roomSchema: Model<RoomDocument>,
    private readonly usersService: UsersService,
  ) {}

  async isExist(name: string) {
    return !!(await this.roomSchema.findOne({ name }));
  }

  async create(createRoomDto: CreateRoomDto) {
    const exist = await this.isExist(createRoomDto.title);
    if (exist) throw new NotAcceptableException();

    const newRoom = new this.roomSchema({
      name: createRoomDto.title,
      logo: createRoomDto.logo,
    });
    return await newRoom.save();
  }

  findAll() {
    return this.roomSchema.find().limit(6);
  }

  findById(id: string) {
    return this.roomSchema.findById(id);
  }

  async update(id: string, updateRoomDto: UpdateRoomDto) {
    const exist = await this.isExist(updateRoomDto.title);
    if (exist) throw new NotAcceptableException();

    const updatedRoom = await this.roomSchema.findByIdAndUpdate(
      id,
      {
        name: updateRoomDto.title,
        logo: updateRoomDto.logo,
        updatedAt: Date.now,
      },
      { new: true },
    );
    return updatedRoom;
  }

  private async addMember({ roomId, userId }: AddMemberByIdDto) {
    try {
      const user = await this.usersService.findById(userId);
      const room = await this.roomSchema.findByIdAndUpdate(
        roomId,
        {
          $addToSet: {
            members: user,
          },
        },
        { new: true },
      );
      return { members: room.members.length };
    } catch (error) {
      Logger.error(error.message, this.name);
      throw new InternalServerErrorException(error.message);
    }
  }

  remove(id: number) {
    return `This action removes a #${id} room`;
  }

  async requestJoinRoom({ roomId, userId }: AddMemberByIdDto) {
    let room: RoomDocument;
    let user: UserDocument;
    try {
      room = await this.findById(roomId);
      user = await this.usersService.findById(userId);
    } catch (error) {
      throw new BadRequestException('Provided id did not exists.');
    }

    if (!room.private || room.waitlist.includes(user)) {
      return await this.addMember({ roomId, userId });
    }

    try {
      const updatedRoom = await this.roomSchema.findByIdAndUpdate(
        roomId,
        {
          $addToSet: {
            waitlist: user,
          },
        },
        { new: true },
      );
      return { waitlist: updatedRoom.waitlist.length };
    } catch (error) {
      throw new Error(error.message);
    }
  }
}
