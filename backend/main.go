package main

import (
	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "pongpong",
		})
	})
	r.Run(":8080")
}

// curl http://localhost:8080/ping
