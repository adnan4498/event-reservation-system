import type { Request, Response } from "express"

export const dashboardTestingController = async (req: Request, res: Response) => {

    res.status(200).json({
        message: "testing"
    })

}