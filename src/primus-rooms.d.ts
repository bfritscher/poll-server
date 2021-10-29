declare module "primus-rooms" {
    interface PrimusRooms {
        Rooms:any;
        Adapter:any;
        server(primus:any, options:any):any;
    }
  }
