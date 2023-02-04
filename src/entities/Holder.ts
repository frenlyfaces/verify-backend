import {
    Entity,
    Column,
    Unique,
    PrimaryGeneratedColumn,
    Index,
    PrimaryColumn,
} from "typeorm";

@Entity()
@Unique(["discordId"])
export class Holder {
    @PrimaryColumn({ type: "varchar" })
    address!: string;

    @Column({ type: "varchar" })
    discordId!: string;

    @Column({ type: "numeric" })
    balance!: number;
}
